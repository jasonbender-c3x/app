#!/bin/bash
set -e

echo "🐱 Setting up Meowstik development environment..."

# Initialize PostgreSQL if needed
if [ ! -d "$HOME/.asdf" ]; then
  echo "📦 Installing PostgreSQL..."
  # PostgreSQL should be installed via devcontainer feature
fi

# Check if .env file exists
if [ ! -f .env ]; then
  echo "⚠️  No .env file found. Creating from example..."
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
    echo "⚠️  Please configure your environment variables in .env"
  else
    echo "ℹ️  No .env.example found. You may need to create .env manually."
  fi
fi

# Set up database
echo "🗄️  Setting up database..."
if command -v psql &> /dev/null; then
  # Database setup would go here
  # For now, we'll rely on the user to configure their database
  echo "✅ PostgreSQL is available"
else
  echo "⚠️  PostgreSQL not found. You may need to configure it manually."
fi

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "📚 Quick start:"
echo "  1. Configure your .env file with required credentials"
echo "  2. Run 'npm run db:push' to sync the database schema"
echo "  3. Run 'npm run dev' to start the development server"
echo "  4. Open http://localhost:5000 in your browser"
echo ""
