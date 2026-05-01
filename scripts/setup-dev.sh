#!/bin/bash
# Setup Development Environment

set -e

echo "🚀 Configurando ambiente de desenvolvimento..."

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js não encontrado. Instale Node.js >= 18"
  exit 1
fi

echo "✅ Node.js $(node -v)"

# Install dependencies
echo "📦 Instalando dependências..."
npm install

# Setup environment files
if [ ! -f apps/web/.env.local ]; then
  echo "📝 Criando .env.local para web..."
  cat > apps/web/.env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF
fi

if [ ! -f apps/mobile/.env ]; then
  echo "📝 Criando .env para mobile..."
  cat > apps/mobile/.env << EOF
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF
fi

# Check Supabase CLI
if command -v supabase &> /dev/null; then
  echo "✅ Supabase CLI encontrado"
  echo "Iniciando Supabase local..."
  cd supabase && supabase start && cd ..
else
  echo "⚠️  Supabase CLI não encontrado. Instale: npm install -g supabase"
fi

echo ""
echo "✅ Setup concluído!"
echo ""
echo "Próximos passos:"
echo "  npm run dev:web    - Inicia o dashboard web"
echo "  npm run dev:mobile - Inicia o app mobile"
