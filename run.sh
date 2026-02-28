#!/bin/bash

# ============================================
# VoiceFlow Marketing AI - Run Script
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════╗"
echo "║     🎙️  VoiceFlow Marketing AI            ║"
echo "║     Voice AI + Marketing Automation       ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "${YELLOW}Python version: ${PYTHON_VERSION}${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Parse arguments
MODE=${1:-"dev"}

case $MODE in
    "dev")
        echo -e "${GREEN}Starting in DEVELOPMENT mode...${NC}"
        
        # Create virtual environment if not exists
        if [ ! -d "venv" ]; then
            echo -e "${YELLOW}Creating virtual environment...${NC}"
            python3 -m venv venv
        fi
        
        # Activate virtual environment
        source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
        
        # Install dependencies
        echo -e "${YELLOW}Installing dependencies...${NC}"
        pip install -r requirements.txt -q
        
        # Set environment
        export APP_ENV=development
        export DEBUG=True
        
        # Check for .env file
        if [ ! -f ".env" ]; then
            echo -e "${YELLOW}No .env file found. Copying from .env.example...${NC}"
            cp .env.example .env
            echo -e "${RED}Please edit .env with your API keys!${NC}"
        fi
        
        # Load environment variables
        if [ -f ".env" ]; then
            export $(grep -v '^#' .env | xargs)
        fi
        
        # Start server with reload
        echo -e "${GREEN}Starting API server...${NC}"
        echo -e "${BLUE}Dashboard: http://localhost:8000${NC}"
        echo -e "${BLUE}API Docs:  http://localhost:8000/docs${NC}"
        
        uvicorn src.api.server:app --reload --host 0.0.0.0 --port 8000
        ;;
        
    "prod")
        echo -e "${GREEN}Starting in PRODUCTION mode...${NC}"
        
        # Load environment variables
        if [ -f ".env" ]; then
            export $(grep -v '^#' .env | xargs)
        fi
        
        export APP_ENV=production
        export DEBUG=False
        
        # Start with gunicorn
        if command_exists gunicorn; then
            gunicorn src.api.server:app \
                -w 4 \
                -k uvicorn.workers.UvicornWorker \
                -b 0.0.0.0:8000 \
                --access-logfile - \
                --error-logfile -
        else
            uvicorn src.api.server:app --host 0.0.0.0 --port 8000 --workers 4
        fi
        ;;
        
    "docker")
        echo -e "${GREEN}Starting with Docker Compose...${NC}"
        
        # Check Docker
        if ! command_exists docker; then
            echo -e "${RED}Docker not found. Please install Docker.${NC}"
            exit 1
        fi
        
        # Build and start
        docker-compose up -d --build
        
        echo -e "${GREEN}Services started!${NC}"
        echo -e "${BLUE}API:        http://localhost:8000${NC}"
        echo -e "${BLUE}Dashboard:  http://localhost:80${NC}"
        echo -e "${BLUE}n8n:        http://localhost:5678${NC}"
        echo -e "${BLUE}Grafana:    http://localhost:3000${NC}"
        
        # Show logs
        docker-compose logs -f api
        ;;
        
    "test")
        echo -e "${GREEN}Running tests...${NC}"
        
        # Activate virtual environment
        source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
        
        # Run tests
        pytest tests/ -v --cov=src --cov-report=term-missing
        ;;
        
    "init-db")
        echo -e "${GREEN}Initializing database...${NC}"
        
        # Activate virtual environment
        source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
        
        # Load environment
        if [ -f ".env" ]; then
            export $(grep -v '^#' .env | xargs)
        fi
        
        # Initialize database
        python -c "from src.api.models import init_db; init_db(); print('Database initialized!')"
        ;;
        
    "install-workflows")
        echo -e "${GREEN}Installing n8n workflows...${NC}"
        
        # Activate virtual environment
        source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
        
        # Load environment
        if [ -f ".env" ]; then
            export $(grep -v '^#' .env | xargs)
        fi
        
        # Install workflows
        python -c "
import asyncio
from src.workflows.n8n_workflows import N8NWorkflowManager, install_all_workflows

async def main():
    manager = N8NWorkflowManager()
    results = await install_all_workflows(manager)
    for wf_id, result in results.items():
        status = '✅' if result.get('success') else '❌'
        print(f'{status} {wf_id}: {result}')

asyncio.run(main())
"
        ;;
        
    "frontend")
        echo -e "${GREEN}Opening frontend dashboard...${NC}"
        
        # Open in browser
        if command_exists xdg-open; then
            xdg-open frontend/index.html
        elif command_exists open; then
            open frontend/index.html
        else
            echo -e "${BLUE}Open frontend/index.html in your browser${NC}"
        fi
        ;;
        
    "help"|"-h"|"--help")
        echo "Usage: ./run.sh [mode]"
        echo ""
        echo "Modes:"
        echo "  dev               Start in development mode (default)"
        echo "  prod              Start in production mode"
        echo "  docker            Start with Docker Compose"
        echo "  test              Run tests"
        echo "  init-db           Initialize database"
        echo "  install-workflows Install n8n workflows"
        echo "  frontend          Open frontend dashboard"
        echo "  help              Show this help message"
        ;;
        
    *)
        echo -e "${RED}Unknown mode: $MODE${NC}"
        echo "Run './run.sh help' for usage information."
        exit 1
        ;;
esac
