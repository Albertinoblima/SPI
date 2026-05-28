'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Users, RefreshCw, AlertTriangle, CheckCircle2, Lock, Unlock } from 'lucide-react';

/**
 * InterviewerQuotaAssignment
 * 
 * Componente profissional para atribuição de cotas por entrevistador.
 * 
 * Decisões de arquitetura:
 * - Reutilizável (pode ser usado no fluxo de 5 passos ou no SurveyWizard).
 * - Trabalha em cima das cotas geográficas já definidas (respeita totais por localidade).
 * - Sugestões automáticas de distribuição (igualitária / proporcional).
 * - Validação em tempo real para não exceder cotas geográficas.
 * - Visual limpo com cards por entrevistador + resumo.
 */

export interface Interviewer {
  userId: string;
  fullName: string;
  email?: string;
}

export interface GeographicQuota {
  name: string;           // ex: "São Paulo - SP" ou nome da localidade
  localityId?: string;
  totalInterviews: number; // cota geográfica total definida no passo anterior
}

export interface InterviewerQuota {
  interviewerId: string;
  localityKey: string;    // nome ou id da localidade
  interviews: number;
}

interface Props {
  interviewers: Interviewer[];
  geographicQuotas: GeographicQuota[];
  initialAssignments?: InterviewerQuota[];
  onChange: (assignments: InterviewerQuota[]) => void;
  onSave?: (assignments: InterviewerQuota[]) => Promise<void>;
  disabled?: boolean;
}

export function InterviewerQuotaAssignment({
  interviewers,
  geographicQuotas,
  initialAssignments = [],
  onChange,
  onSave,
  disabled = false,
}: Props) {
  const [assignments, setAssignments] = useState<InterviewerQuota[]>(initialAssignments);
  const [lockedInterviewers, setLockedInterviewers] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Chave única para cada cota geográfica
  const geoKeys = useMemo(() => geographicQuotas.map(q => q.name), [geographicQuotas]);

  // Total planejado por localidade (soma de todos os entrevistadores)
  const assignedByLocality = useMemo(() => {
    const map: Record<string, number> = {};
    geographicQuotas.forEach(q => { map[q.name] = 0; });

    assignments.forEach(a => {
      if (map[a.localityKey] !== undefined) {
        map[a.localityKey] += a.interviews;
      }
    });
    return map;
  }, [assignments, geographicQuotas]);

  // Totais por entrevistador
  const totalsByInterviewer = useMemo(() => {
    const map: Record<string, number> = {};
    interviewers.forEach(i => { map[i.userId] = 0; });

    assignments.forEach(a => {
      if (map[a.interviewerId] !== undefined) {
        map[a.interviewerId] += a.interviews;
      }
    });
    return map;
  }, [assignments, interviewers]);

  const grandTotal = useMemo(() => 
    Object.values(totalsByInterviewer).reduce((s, v) => s + v, 0)
  , [totalsByInterviewer]);

  const totalGeographic = useMemo(() =>
    geographicQuotas.reduce((s, q) => s + q.totalInterviews, 0)
  , [geographicQuotas]);

  // Validação: alguma localidade está sobrecarregada?
  const overAssignedLocalities = useMemo(() => {
    return geographicQuotas.filter(q => 
      (assignedByLocality[q.name] || 0) > q.totalInterviews
    );
  }, [assignedByLocality, geographicQuotas]);

  const hasOverAssignment = overAssignedLocalities.length > 0;

  // Sincronizar mudanças para o pai
  useEffect(() => {
    onChange(assignments);
  }, [assignments, onChange]);

  const updateAssignment = (interviewerId: string, localityKey: string, value: number) => {
    if (disabled || lockedInterviewers.has(interviewerId)) return;

    const newValue = Math.max(0, Math.floor(value));

    setAssignments(prev => {
      const existing = prev.findIndex(
        a => a.interviewerId === interviewerId && a.localityKey === localityKey
      );

      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = { ...copy[existing], interviews: newValue };
        return copy;
      } else {
        return [...prev, { interviewerId, localityKey, interviews: newValue }];
      }
    });
  };

  const toggleLock = (interviewerId: string) => {
    if (disabled) return;
    setLockedInterviewers(prev => {
      const next = new Set(prev);
      if (next.has(interviewerId)) next.delete(interviewerId);
      else next.add(interviewerId);
      return next;
    });
  };

  // Distribui igualmente entre todos os entrevistadores (respeitando locks)
  const distributeEqually = () => {
    if (disabled || geographicQuotas.length === 0) return;

    const activeInterviewers = interviewers.filter(i => !lockedInterviewers.has(i.userId));
    if (activeInterviewers.length === 0) return;

    const perInterviewer = Math.floor(totalGeographic / activeInterviewers.length);
    let remainder = totalGeographic % activeInterviewers.length;

    const newAssignments: InterviewerQuota[] = [];

    // Mantém as cotas travadas
    assignments.forEach(a => {
      if (lockedInterviewers.has(a.interviewerId)) {
        newAssignments.push(a);
      }
    });

    activeInterviewers.forEach((interviewer, idx) => {
      const base = perInterviewer + (idx < remainder ? 1 : 0);
      
      geographicQuotas.forEach(geo => {
        // Distribui de forma simples: cada entrevistador ativo recebe uma fatia da cota geográfica
        const share = Math.floor(geo.totalInterviews / activeInterviewers.length);
        newAssignments.push({
          interviewerId: interviewer.userId,
          localityKey: geo.name,
          interviews: share,
        });
      });
    });

    // Ajuste fino para bater no total
    let currentTotal = newAssignments.reduce((s, a) => s + a.interviews, 0);
    let diff = totalGeographic - currentTotal;

    let i = 0;
    while (diff !== 0 && i < 500) {
      const unlocked = newAssignments.filter(a => !lockedInterviewers.has(a.interviewerId));
      if (unlocked.length === 0) break;

      const target = unlocked[i % unlocked.length];
      if (diff > 0) {
        target.interviews += 1;
        diff--;
      } else {
        if (target.interviews > 0) {
          target.interviews -= 1;
          diff++;
        }
      }
      i++;
    }

    setAssignments(newAssignments);
    setMessage('Distribuição igualitária aplicada.');
    setTimeout(() => setMessage(null), 2500);
  };

  // Distribui proporcionalmente à cota geográfica de cada localidade
  const distributeProportionally = () => {
    if (disabled || geographicQuotas.length === 0) return;

    const active = interviewers.filter(i => !lockedInterviewers.has(i.userId));
    if (active.length === 0) return;

    const newAssignments: InterviewerQuota[] = [];

    // Preserva travados
    assignments.forEach(a => {
      if (lockedInterviewers.has(a.interviewerId)) newAssignments.push(a);
    });

    geographicQuotas.forEach(geo => {
      const perPerson = Math.floor(geo.totalInterviews / active.length);
      let rem = geo.totalInterviews % active.length;

      active.forEach((intv, idx) => {
        const val = perPerson + (idx < rem ? 1 : 0);
        newAssignments.push({
          interviewerId: intv.userId,
          localityKey: geo.name,
          interviews: val,
        });
      });
    });

    setAssignments(newAssignments);
    setMessage('Distribuição proporcional aplicada.');
    setTimeout(() => setMessage(null), 2500);
  };

  const handleSave = async () => {
    if (!onSave || hasOverAssignment) return;

    setSaving(true);
    try {
      await onSave(assignments);
      setMessage('Distribuição salva com sucesso!');
    } catch (e: any) {
      setMessage(e.message || 'Erro ao salvar distribuição.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (interviewers.length === 0) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="w-5 h-5" />
          <span>Nenhum entrevistador cadastrado na equipe desta pesquisa.</span>
        </div>
        <p className="text-sm text-amber-600 mt-2">
          Vá até a etapa de Equipe e adicione membros com papel "Entrevistador".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Atribuição por Entrevistador</h3>
            <p className="text-sm text-slate-500">
              Distribua as cotas geográficas entre os membros da equipe de campo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={distributeEqually}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Distribuir Igualmente
          </button>
          <button
            onClick={distributeProportionally}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Proporcional às Cotas
          </button>
        </div>
      </div>

      {/* Resumo Global */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-slate-500">TOTAL PLANEJADO</div>
          <div className="text-3xl font-semibold mt-1">{grandTotal}</div>
          <div className="text-xs text-slate-400">de {totalGeographic} entrevistas</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-slate-500">ENTREVISTADORES ATIVOS</div>
          <div className="text-3xl font-semibold mt-1">{interviewers.length}</div>
          <div className="text-xs text-slate-400">
            {lockedInterviewers.size} travados
          </div>
        </div>
        <div className={`border rounded-xl p-4 ${hasOverAssignment ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center gap-2">
            {hasOverAssignment ? (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            )}
            <div className={`text-sm font-medium ${hasOverAssignment ? 'text-red-700' : 'text-emerald-700'}`}>
              {hasOverAssignment 
                ? `${overAssignedLocalities.length} localidade(s) com excesso` 
                : 'Distribuição dentro dos limites'}
            </div>
          </div>
          <div className="text-xs mt-1 text-slate-500">
            A soma por localidade não pode exceder a cota geográfica definida.
          </div>
        </div>
      </div>

      {message && (
        <div className="text-sm px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
          {message}
        </div>
      )}

      {/* Tabela Principal por Entrevistador */}
      <div className="bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-64">Entrevistador</th>
              {geoKeys.map(key => (
                <th key={key} className="text-center px-3 py-3 font-medium text-slate-600 min-w-[90px]">
                  {key.length > 18 ? key.substring(0, 16) + '...' : key}
                  <div className="text-[10px] text-slate-400 font-normal">cota: {geographicQuotas.find(q => q.name === key)?.totalInterviews}</div>
                </th>
              ))}
              <th className="text-right px-4 py-3 font-medium text-slate-600">Total Pessoal</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {interviewers.map((intv) => {
              const isLocked = lockedInterviewers.has(intv.userId);
              const personalTotal = totalsByInterviewer[intv.userId] || 0;

              return (
                <tr key={intv.userId} className={isLocked ? 'bg-slate-50' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{intv.fullName}</div>
                    {intv.email && <div className="text-xs text-slate-400">{intv.email}</div>}
                  </td>

                  {geoKeys.map(geoKey => {
                    const current = assignments.find(a => 
                      a.interviewerId === intv.userId && a.localityKey === geoKey
                    )?.interviews || 0;

                    const geoTotal = geographicQuotas.find(q => q.name === geoKey)?.totalInterviews || 0;
                    const otherAssigned = assignedByLocality[geoKey] - current;
                    const maxAllowed = Math.max(0, geoTotal - otherAssigned);

                    return (
                      <td key={geoKey} className="px-2 py-2 text-center">
                        <input
                          type="number"
                          value={current}
                          onChange={(e) => updateAssignment(intv.userId, geoKey, parseInt(e.target.value) || 0)}
                          disabled={disabled || isLocked}
                          className="w-20 text-center border rounded px-2 py-1 disabled:bg-slate-100"
                          min={0}
                          max={maxAllowed}
                        />
                      </td>
                    );
                  })}

                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {personalTotal}
                  </td>

                  <td className="px-2">
                    <button
                      onClick={() => toggleLock(intv.userId)}
                      disabled={disabled}
                      className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"
                      title={isLocked ? 'Destravar' : 'Travar este entrevistador (não será alterado nas redistribuições)'}
                    >
                      {isLocked ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4 text-slate-400" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot className="bg-slate-50 font-medium">
            <tr>
              <td className="px-4 py-3 text-slate-600">Total por Localidade</td>
              {geoKeys.map(key => {
                const assigned = assignedByLocality[key] || 0;
                const max = geographicQuotas.find(q => q.name === key)?.totalInterviews || 0;
                const over = assigned > max;
                return (
                  <td key={key} className={`px-3 py-3 text-center tabular-nums ${over ? 'text-red-600 font-bold' : ''}`}>
                    {assigned} / {max}
                  </td>
                );
              })}
              <td className="px-4 py-3 text-right">{grandTotal} / {totalGeographic}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {hasOverAssignment && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Atenção:</strong> A soma das cotas atribuídas excede a cota geográfica em uma ou mais localidades. 
            Ajuste os valores antes de salvar ou publicar a pesquisa.
          </div>
        </div>
      )}

      {onSave && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={disabled || saving || hasOverAssignment}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:bg-slate-300"
          >
            {saving ? 'Salvando...' : 'Salvar Distribuição por Entrevistador'}
          </button>
        </div>
      )}

      <div className="text-xs text-slate-500 px-1">
        Dica: Use os botões de redistribuição automática acima. Travar um entrevistador protege sua cota durante os ajustes.
      </div>
    </div>
  );
}

export default InterviewerQuotaAssignment;