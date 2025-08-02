# VinoCRM - Customer Management System

## Overview
VinoCRM is a full-stack customer relationship management (CRM) application designed for managing clients and deals. It features a modern, responsive interface with a kanban-style board for deal tracking. The system aims to streamline customer and deal management, offering capabilities for comprehensive client records, efficient deal progression, and robust reporting.

## User Preferences
Preferred communication style: Simple, everyday language in Portuguese (Brazilian Portuguese).

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Components**: Radix UI primitives, Shadcn/ui, custom styling with Tailwind CSS and CSS variables
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API
- **Development**: tsx
- **Production**: esbuild

### Data Layer
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Schema**: Shared TypeScript definitions with Zod validation
- **Storage Interface**: DatabaseStorage class for PostgreSQL persistence

### Key Features
- **Client Management**: Full CRUD operations, CPF and address validation, search/filtering, modal-based forms.
- **Deal Management**: Kanban board with drag-and-drop, three stages (Prospecção, Negociação, Fechamento), client association, value tracking, notes.
- **UI/UX**: Responsive design, toast notifications, loading states, error handling, wine-themed color scheme, consistent component library.
- **Access Control**: Role-based access for features like "Administração de Metas", settings, reports, and data visibility (e.g., sellers see only their companies).
- **Cashback System**: Configurable expiration, redemption, detailed transaction history, and balance tracking integrated into client profiles.
- **Import/Export**: Functionality for importing and exporting client data, including Excel support.

### Data Flow
- Frontend requests interact with the Express backend.
- Backend processes data, validates using Zod, and interacts with PostgreSQL via Drizzle ORM.
- React Query manages frontend cache and UI updates based on backend responses.

### File Structure
The application follows a monorepo structure:
- `client/`: React frontend
- `server/`: Express.js backend
- `shared/`: Shared TypeScript definitions and schemas
- `migrations/`: Database migration files
- `dist/`: Production build output

## External Dependencies

### Production Dependencies
- **UI Framework**: React ecosystem
- **Database**: Neon PostgreSQL (serverless)
- **Validation**: Zod
- **Styling**: Tailwind CSS
- **HTTP Client**: Native fetch API
- **Date Handling**: date-fns

### Development Tools
- **Build Tools**: Vite (for frontend), esbuild (for backend)
- **Database Tools**: Drizzle Kit (for schema and migrations)
- **Development Server**: Vite dev server with HMR
- **Code Quality**: TypeScript strict mode