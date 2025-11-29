# Gestão Adapta Fiscal

## Overview
Gestão Adapta Fiscal is a comprehensive multi-tenant NFe/NFCe XML management platform designed for Brazilian fiscal document management. The platform enables automated processing, validation, and accounting integration for electronic invoices (NFe and NFCe).

## Purpose
This application provides:
- **Multi-tenant architecture** - Multiple users and companies with role-based access
- **XML processing** - Automated parsing and validation of NFe/NFCe documents
- **SEFAZ compliance** - Validation against tax authority schemas
- **Batch operations** - Upload and process multiple XMLs simultaneously
- **Accounting integration** - Send processed documents to accountants via email
- **Audit trail** - Complete logging of all user actions

## Tech Stack
### Frontend
- React with Vite
- Wouter for routing
- TailwindCSS with professional fiscal theme (green primary color)
- Shadcn UI components
- React Query for data fetching
- Chart.js for data visualization
- React Dropzone for file uploads

### Backend
- Node.js with Express
- PostgreSQL database (Drizzle ORM)
- JWT authentication with bcrypt
- XML parsing with xml2js
- Email sending with Nodemailer
- File storage with Replit Object Storage (local)
- **Contabo Object Storage** - S3-compatible cloud storage for XMLs

## Contabo Object Storage Integration
### Configuration
The system uses Contabo Object Storage (S3-compatible) for storing XML files organized by company CNPJ.

**Environment Variables:**
- `CONTABO_STORAGE_ENDPOINT` - Storage endpoint (https://usc1.contabostorage.com)
- `CONTABO_STORAGE_REGION` - Region (us-east-1)
- `CONTABO_STORAGE_BUCKET` - Bucket name (caixafacil)
- `CONTABO_STORAGE_ACCESS_KEY` - S3 access key
- `CONTABO_STORAGE_SECRET_KEY` - S3 secret key

### Storage Structure
```
{cnpj}/
  └── xmls/
      └── {chaveAcesso}.xml
```

Example: `12345678000190/xmls/35241112345678000190550010000001231234567890.xml`

### API Endpoints
- `GET /api/storage/test` - Test storage connection
- `POST /api/storage/upload-xml` - Upload XML file
- `GET /api/storage/xmls/:companyId` - List XMLs for a company
- `GET /api/storage/xml/:companyId/:chaveAcesso` - Download XML
- `GET /api/storage/xml-exists/:companyId/:chaveAcesso` - Check if XML exists
- `DELETE /api/storage/xml/:companyId/:chaveAcesso` - Delete XML (admin only)
- `DELETE /api/storage/company/:companyId` - Delete all files for company (admin only)
- `GET /api/storage/signed-url/:companyId/:chaveAcesso` - Get signed download URL
- `GET /api/storage/stats/:companyId` - Get storage statistics

### Storage Module
File: `server/contaboStorage.ts`
- `uploadXml(xmlContent, cnpj, chaveAcesso)` - Upload XML
- `getXml(cnpj, chaveAcesso)` - Download XML content
- `listXmlsByCompany(cnpj)` - List all XMLs
- `deleteXml(cnpj, chaveAcesso)` - Delete XML
- `xmlExists(cnpj, chaveAcesso)` - Check existence
- `testStorageConnection()` - Test connection

## Database Schema
### Core Tables
- **users** - User accounts with email/password
- **companies** - Client companies (emitentes) with CNPJ and business details
- **company_users** - Multi-tenant user-company relationships
- **accountants** - Accounting firms with contact information
- **accountant_companies** - Accountant-company relationships
- **xmls** - Processed NFe/NFCe documents with metadata
- **actions** - Audit trail of all user actions

### Key Features
- Multi-tenant design allows users to switch between companies
- Role-based access control (admin, editor, viewer)
- Complete address and email configuration for companies
- Automatic categorization of XMLs (emitida vs recebida) based on CNPJ

## Project Structure
```
client/
  src/
    components/
      dashboard-layout.tsx - Main layout with sidebar
      ui/ - Shadcn UI components
    pages/
      login.tsx - Split-screen Asaas-style login
      dashboard.tsx - KPIs, charts, recent XMLs
      clientes.tsx - Company management
      contabilidades.tsx - Accountant management
      xmls.tsx - XML listing with filters
      upload.tsx - Batch XML upload
      relatorios.tsx - Reports (future)
    lib/
      queryClient.ts - React Query setup

server/
  routes.ts - API endpoints
  storage.ts - Database interface
  db.ts - Drizzle database connection (to be implemented)

shared/
  schema.ts - Complete database schema with Drizzle
```

## Current State (Task 1 Complete)
### Completed
✅ Complete database schema with all tables and relations
✅ Professional design system with fiscal theme (green accent)
✅ All frontend components with exceptional visual polish:
  - Modern split-screen login (Asaas-inspired)
  - Dashboard with KPIs, pie charts, line charts, and recent XMLs table
  - Client (emitente) management with comprehensive forms
  - Accountant management with company associations
  - XML listing with filters, search, and pagination
  - File upload interface with drag-and-drop and progress tracking
  - Professional sidebar navigation with company switcher
  - Responsive design across all breakpoints
✅ Complete routing setup
✅ All pages with proper data-testid attributes
✅ Loading states, empty states, and error states
✅ Consistent spacing, typography, and color usage

### Next Steps
- Task 2: Implement complete backend with authentication, API routes, XML parsing
- Task 3: Connect frontend to backend, add real data fetching, testing

## Design Guidelines
The application follows a professional fiscal management aesthetic:
- **Primary Color**: Green (HSL 142, 71%, 45%) for trust and compliance
- **Typography**: Inter font family for all text
- **Components**: Shadcn UI for consistency
- **Layout**: Sidebar navigation with company dropdown
- **Forms**: Clean inputs with validation
- **Tables**: Data-dense with proper formatting
- **Charts**: Chart.js for KPIs and trends

## User Roles
- **Admin**: Full access to all features
- **Editor**: Can manage companies, XMLs, and accountants
- **Viewer**: Read-only access to documents

## MVP Features
1. User authentication with JWT
2. Multi-company management
3. Client (emitente) registration with CNPJ validation
4. Accountant registration with multi-company support
5. Batch XML upload with drag-and-drop
6. XML parsing and categorization
7. XML listing with filters and search
8. Dashboard with KPIs and visualizations
9. Email sending to accountants
10. Audit logging

## Future Enhancements (Phase 2)
- IMAP email monitoring for automatic XML downloads
- Real-time SEFAZ validation API integration
- DANFE PDF generation
- Excel and PDF report exports
- Advanced filtering and search
- API endpoints for external integrations
