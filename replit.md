# VinoCRM - Customer Management System

## Overview

VinoCRM is a full-stack customer relationship management (CRM) application built with React, TypeScript, and Express.js. The system provides functionality for managing clients and deals through a modern, responsive interface with a kanban-style board for deal tracking.

## User Preferences

Preferred communication style: Simple, everyday language in Portuguese (Brazilian Portuguese).

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Radix UI primitives with custom styling
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints for CRUD operations
- **Development**: tsx for TypeScript execution in development
- **Production**: esbuild for optimized bundling

### Data Layer
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL with persistent storage
- **Schema**: Shared TypeScript schema definitions with relations
- **Validation**: Zod schemas for runtime validation
- **Storage Interface**: DatabaseStorage class with PostgreSQL persistence

## Key Components

### Client Management
- Complete CRUD operations for client records
- Form validation with CPF (Brazilian tax ID) validation
- Address management with Brazilian postal codes
- Search and filtering capabilities
- Modal-based forms for creating and editing

### Deal Management
- Kanban board interface with three stages: Prospecção, Negociação, Fechamento
- Drag-and-drop functionality for deal progression
- Deal associations with client records
- Value tracking with Brazilian currency formatting
- Notes and stage management

### UI/UX Features
- Responsive design optimized for desktop and mobile
- Toast notifications for user feedback
- Loading states and error handling
- Wine-themed color scheme with professional styling
- Shadcn/ui component library for consistent design

## Data Flow

### Recent Updates (July 28-29, 2025)
- Fixed Calendar icon import error that was preventing app startup
- Corrected component type errors in deal forms and kanban boards  
- Fixed data type issues with array handling and date formatting
- Updated property names to match schema (stageId vs stage)
- Fixed authentication system to properly use bcrypt for password comparison
- App now starts successfully and loads properly
- Login credentials: admin@vinocrm.com / 123456 or admin@vinocrm.com.br / 123456
- Modified client registration form to use dynamic data from Settings page
- Marcadores dropdown now pulls from /api/markers (created in Settings)
- Categoria dropdown now pulls from /api/categories (created in Settings)  
- Origem dropdown now pulls from /api/origins (created in Settings)
- Removed hardcoded values, ensuring centralized data management
- Added user-friendly messages when no options are available
- Updated database with comprehensive sets of categories, origins, and markers
- Database now contains 14 categories, 18 origins, and 25 markers with appropriate colors
- Removed mandatory requirement for address fields in client registration
- Fixed sidebar navigation issues with disappearing pages
- Added scrollbar to sidebar for better navigation when content overflows
- Made "GRAND CRU" logo clickable to return to main clients page
- Fixed popup appearance issues by forcing light theme on all modal components
- Improved CSS with custom scrollbar styling and proper component theming
- Converted all tabs into separate dedicated pages for better navigation
- Created comprehensive company details modal accessible by clicking company names
- Added WhatsApp integration with clickable icons next to phone numbers
- Implemented company selection and bulk deletion functionality
- Added phone column to company table with WhatsApp integration
- Fixed Select component errors in company registration form
- Completed companies IMPORT functionality with Excel support and validation
- Implemented comprehensive "Administração de Metas" page for admin-only access
- Added userGoals database table with salesGoal, averageTicket, itemsPerSale fields
- Created complete backend API for goals management (GET, POST, PUT, DELETE)
- Added role-based access control - "Admin Metas" link only visible to administrators
- Fixed admin login credentials and created test users for goals functionality
- Backend API tested and working correctly for goals CRUD operations
- Implemented permission-based filtering for COMPANIES tab - sellers only see companies they are responsible for
- Added role-based access control to Settings page - restricted to administrators only
- Updated sidebar to hide "Configurações" link for non-admin users
- Backend and frontend updated with user permission filtering for both clients and companies
- Enhanced Reports page with comprehensive company statistics and analytics
- Added company cards showing total companies, sectors breakdown, and geographical distribution
- Implemented company filtering by sector, responsible user, state, and city
- Reports page now displays both client and company metrics with permission-based data filtering
- Updated permission system to allow GERENTE role access to Admin Metas page alongside administrators
- Sidebar already configured to show Admin Metas link for both admin and gerente roles
- Fixed client import functionality with proper field mapping and validation (July 30, 2025)
- Corrected responsavelId mapping to convert user names to IDs during import process
- Added normalization for number/string field types to prevent validation errors
- Fixed cashback transaction date validation error (July 30, 2025)
- Updated insertCashbackTransactionSchema to accept string dates and convert to Date objects
- Resolved "Expected date, received string" validation error when saving sales transactions
- Fixed cashback settings update API error returning HTML instead of JSON (July 30, 2025)
- Added missing PUT and DELETE routes for /api/cashback-settings/:id
- Resolved "Unexpected token '<', '<!DOCTYPE'" error when updating cashback configurations
- Fixed cashback settings validation error with empty date fields (July 30, 2025)
- Updated frontend to properly handle empty strings by converting to null for optional fields
- Resolved "Expected date, received string" error when validUntil field is empty
- Implemented cashback redemption functionality in client details and cashback page (July 30, 2025)
- Added "Saldos" tab to cashback page with full redemption capabilities
- Completed "Transações" and "Relatórios" tabs showing real system data and analytics
- Fixed cashback redemption UI components now fully visible and functional
- Enhanced "Transações" tab to show unified view of both cashback earnings and redemptions (July 30, 2025)
- Combined transactions now display chronologically with clear type indicators and color coding
- Implemented three action buttons in Client Details header (July 30, 2025):
  - "Lançar Venda": Opens sale form modal to register new purchases
  - "Saldo": Shows detailed cashback balance modal with total earned, used, and current balance
  - "Resgatar": Opens cashback redemption modal (disabled when no balance available)

### Client Flow
1. User creates/edits client through modal forms
2. Form data validated using Zod schemas
3. API requests sent to Express backend
4. Backend validates and processes data
5. Database operations performed through Drizzle ORM
6. Response sent back to frontend
7. React Query updates cache and UI

### Deal Flow
1. Deals displayed in kanban board format
2. Drag-and-drop updates deal stages
3. Deal forms allow creation and editing
4. Client association through dropdown selection
5. Currency values formatted for Brazilian locale
6. Real-time updates through query invalidation

## External Dependencies

### Production Dependencies
- **UI Framework**: React ecosystem with TypeScript support
- **Database**: Neon PostgreSQL serverless database
- **Validation**: Zod for schema validation throughout the stack
- **Styling**: Tailwind CSS with PostCSS processing
- **HTTP Client**: Native fetch API with custom wrapper
- **Date Handling**: date-fns for date formatting and manipulation

### Development Tools
- **Build Tools**: Vite with React plugin and TypeScript support
- **Database Tools**: Drizzle Kit for schema management and migrations
- **Development Server**: Integrated Vite dev server with HMR
- **Code Quality**: TypeScript strict mode enabled

## Deployment Strategy

### Build Process
1. Frontend builds to `dist/public` using Vite
2. Backend bundles to `dist/index.js` using esbuild
3. Static assets served by Express in production
4. Environment-specific configuration through NODE_ENV

### Environment Configuration
- Development: Uses tsx for TypeScript execution with Vite dev server
- Production: Runs compiled JavaScript with static file serving
- Database: Configured for PostgreSQL with connection string from environment
- Replit Integration: Special handling for Replit development environment

### File Structure
```
├── client/          # React frontend application
├── server/          # Express.js backend application  
├── shared/          # Shared TypeScript definitions and schemas
├── migrations/      # Database migration files
└── dist/           # Production build output
```

The application follows a monorepo structure with clear separation between frontend, backend, and shared code, enabling efficient development and deployment workflows.