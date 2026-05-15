#!/usr/bin/env node
/**
 * Gera tse-voter-data.json a partir dos dados do TSE (Perfil do Eleitorado).
 * Versão Node.js — muito mais rápida que a versão PowerShell para grandes estados.
 *
 * Pré-requisito: os ZIPs já devem ter sido baixados em %TEMP%\tse_voters\
 * (o script generate-tse-voters.ps1 faz o download; este script faz só o processamento)
 * OU coloque os ZIPs manualmente na pasta temp abaixo.
 *
 * Uso (a partir da raiz do monorepo):
 *   node scripts/generate-tse-voters.mjs
 *
 * Para forçar re-download (ignorar cache):
 *   node scripts/generate-tse-voters.mjs --force
 */

import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_JSON = path.resolve(__dirname, '../apps/web/src/lib/geo/tse-voter-data.json');
const TEMP_DIR = path.join(os.tmpdir(), 'tse_voters');
const CDN_BASE = 'https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitor_secao';

const UFS = [
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
    'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO', 'ZZ'
];

const AGE_MAP = {
    '"15 anos"': 'a16', '"16 anos"': 'a16', '"17 anos"': 'a16',
    '"18 anos"': 'a18', '"19 anos"': 'a18', '"20 anos"': 'a18', '"21 a 24 anos"': 'a18',
    '"25 a 29 anos"': 'a25', '"30 a 34 anos"': 'a25',
    '"35 a 39 anos"': 'a35', '"40 a 44 anos"': 'a35',
    '"45 a 49 anos"': 'a45', '"50 a 54 anos"': 'a45', '"55 a 59 anos"': 'a45',
    '"60 a 64 anos"': 'a60', '"65 a 69 anos"': 'a60',
    '"70 a 74 anos"': 'a70', '"75 a 79 anos"': 'a70',
    '"80 a 84 anos"': 'a80', '"85 a 89 anos"': 'a80', '"90 a 94 anos"': 'a80',
    '"95 a 99 anos"': 'a80', '"100 anos ou mais"': 'a80',
};

const forceDownload = process.argv.includes('--force');

async function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                file.close();
                fs.unlinkSync(dest);
                return download(res.headers.location, dest).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                file.close();
                fs.unlinkSync(dest);
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
            file.on('error', (err) => { fs.unlinkSync(dest); reject(err); });
        }).on('error', reject);
    });
}

/**
 * Extrai o primeiro arquivo CSV do ZIP usando PowerShell Expand-Archive.
 * Retorna o caminho do CSV extraído.
 */
function extractZip(zipPath, extractDir) {
    const uf = path.basename(zipPath, '.zip').replace('tse_', '');
    const csvDir = path.join(extractDir, uf);
    if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });

    // Usar PowerShell Expand-Archive (disponível no Windows)
    execSync(
        `powershell -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${csvDir}' -Force"`,
        { stdio: 'pipe' }
    );

    const csvFiles = fs.readdirSync(csvDir).filter(f => f.toLowerCase().endsWith('.csv'));
    if (csvFiles.length === 0) throw new Error(`Nenhum CSV encontrado em ${csvDir}`);
    return path.join(csvDir, csvFiles[0]);
}

async function processCSV(csvPath, data) {
    // Node.js suporta 'latin1' (ISO-8859-1) nativamente
    const stream = fs.createReadStream(csvPath, { encoding: 'latin1' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let lineNum = 0;
    let idxUF = -1, idxCod = -1, idxNome = -1, idxGenero = -1, idxFaixa = -1, idxQty = -1;

    for await (const line of rl) {
        lineNum++;
        const parts = line.split(';');

        if (lineNum === 1) {
            // Header
            idxUF = parts.indexOf('"SG_UF"');
            idxCod = parts.indexOf('"CD_MUNICIPIO"');
            idxNome = parts.indexOf('"NM_MUNICIPIO"');
            idxGenero = parts.indexOf('"DS_GENERO"');
            idxFaixa = parts.indexOf('"DS_FAIXA_ETARIA"');
            idxQty = parts.indexOf('"QT_ELEITORES"');

            if (idxUF < 0 || idxCod < 0 || idxQty < 0) {
                console.error('  Colunas não encontradas no header:', parts.slice(0, 5));
                return 0;
            }
            continue;
        }

        if (parts.length <= idxQty) continue;

        const stUF = parts[idxUF].replace(/"/g, '');
        const code = parts[idxCod].replace(/"/g, '');
        const nome = parts[idxNome]?.replace(/"/g, '') ?? '';
        const genero = parts[idxGenero];
        const faixa = parts[idxFaixa];
        const qtyStr = parts[idxQty].replace(/[^\d]/g, '');
        if (!qtyStr) continue;
        const qty = parseInt(qtyStr, 10);
        if (isNaN(qty) || qty <= 0) continue;

        const key = `${stUF}:${code}`;
        if (!data[key]) {
            data[key] = { uf: stUF, code, name: nome, total: 0, m: 0, f: 0, n: 0, a16: 0, a18: 0, a25: 0, a35: 0, a45: 0, a60: 0, a70: 0, a80: 0 };
        }
        const rec = data[key];
        rec.total += qty;
        if (genero === '"MASCULINO"') rec.m += qty;
        else if (genero === '"FEMININO"') rec.f += qty;
        else rec.n += qty;

        const ageGroup = AGE_MAP[faixa];
        if (ageGroup) rec[ageGroup] += qty;
    }

    return lineNum - 1; // Subtract header
}

async function main() {
    console.log('TSE Voter Data Generator (Node.js)');
    console.log('====================================');

    await fsp.mkdir(TEMP_DIR, { recursive: true });
    const extractDir = path.join(TEMP_DIR, 'extracted');
    await fsp.mkdir(extractDir, { recursive: true });

    const data = {};

    for (const uf of UFS) {
        const zipPath = path.join(TEMP_DIR, `tse_${uf}.zip`);
        const url = `${CDN_BASE}/perfil_eleitor_secao_ATUAL_${uf}.zip`;

        // Download se necessário
        const zipExists = fs.existsSync(zipPath);
        if (!zipExists || forceDownload) {
            process.stdout.write(`[${uf}] Baixando... `);
            try {
                await download(url, zipPath);
                const mb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
                console.log(`OK (${mb} MB)`);
            } catch (err) {
                console.log(`ERRO: ${err.message} — pulando.`);
                continue;
            }
        } else {
            const mb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
            console.log(`[${uf}] Cache local (${mb} MB).`);
        }

        // Extrair ZIP
        const csvExtractDir = path.join(extractDir, uf);
        let csvPath;
        try {
            process.stdout.write(`[${uf}] Extraindo ZIP...`);
            csvPath = extractZip(zipPath, extractDir);
            const mb = (fs.statSync(csvPath).size / 1024 / 1024).toFixed(1);
            console.log(` OK (CSV: ${mb} MB)`);
        } catch (err) {
            console.log(` ERRO: ${err.message} — pulando.`);
            continue;
        }

        // Processar CSV
        process.stdout.write(`[${uf}] Processando CSV...`);
        const t0 = Date.now();
        try {
            const lines = await processCSV(csvPath, data);
            const secs = ((Date.now() - t0) / 1000).toFixed(1);
            console.log(` ${lines.toLocaleString()} linhas em ${secs}s. Total: ${Object.keys(data).length} municípios.`);
        } catch (err) {
            console.log(` ERRO: ${err.message}`);
        }

        // Limpar CSV extraído para economizar espaço
        try { fs.rmSync(csvExtractDir, { recursive: true, force: true }); } catch { }
    }

    // Salvar JSON
    const total = Object.keys(data).length;
    console.log(`\nGerando JSON com ${total} municípios...`);
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(data), 'utf8');
    const kb = Math.round(fs.statSync(OUTPUT_JSON).size / 1024);
    console.log(`\nConcluído. ${total} municípios.`);
    console.log(`Arquivo: ${OUTPUT_JSON} (${kb} KB)`);
}

main().catch((err) => {
    console.error('ERRO FATAL:', err);
    process.exit(1);
});
