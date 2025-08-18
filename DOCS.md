# Documentation Index - zev-mud

This document provides an overview of all documentation available in the zev-mud project.

## Main Documentation

### [README.md](README.md)
**Primary project documentation** - Start here for project overview, setup, and basic usage.

**Contents:**
- Project overview and architecture
- Game features and technical capabilities  
- Quick start guide for development and production
- Configuration options and environment variables
- Troubleshooting and performance optimization
- Links to all other documentation

**Audience:** All users - developers, players, operators

### [CONTRIBUTING.md](CONTRIBUTING.md)
**Developer contribution guide** - Everything needed to contribute to the project.

**Contents:**
- Development environment setup
- Code style guidelines and standards
- Testing requirements and strategies
- Pull request process and review guidelines
- Community guidelines and code of conduct

**Audience:** Developers and contributors

### [API.md](API.md)
**Technical API reference** - Comprehensive API documentation for all components.

**Contents:**
- WebSocket proxy API endpoints and message formats
- Web client HTTP API and JavaScript client library
- Ranvier server commands and data formats
- Protocol specifications and message examples
- Error handling and status codes

**Audience:** Developers and integrators

### [DEPLOYMENT.md](DEPLOYMENT.md)
**Production deployment guide** - Complete guide for deploying and operating the system.

**Contents:**
- Production deployment strategies
- SSL/TLS configuration and security hardening
- Container management and monitoring
- Backup and restoration procedures
- Performance tuning and scaling options

**Audience:** System administrators and DevOps engineers

## Component Documentation

### [ranvier/README.md](ranvier/README.md)
**Ranvier MUD server documentation** - Game server setup, world design, and testing.

**Key Sections:**
- World structure (10 rooms, 13+ items, 2+ NPCs)
- Available commands and game mechanics
- Database configuration and character persistence
- Testing procedures and requirements fulfilled

### [proxy/README.md](proxy/README.md)
**WebSocket-Telnet proxy documentation** - Proxy service configuration and usage.

**Key Sections:**
- Protocol bridge functionality
- Connection management and health monitoring
- Configuration options and Docker setup
- Architecture and message processing

### [web-client/README.md](web-client/README.md)
**Web client documentation** - Browser interface setup, features, and troubleshooting.

**Key Sections:**
- Terminal emulation with xterm.js
- WebSocket connection management
- Client-side JavaScript API
- Browser compatibility and responsive design

## Specification Documents (.kiro/)

### [Design Document](.kiro/specs/ranvier-mud-browser-client/design.md)
**System architecture and design decisions** - Detailed technical architecture.

**Contents:**
- High-level system architecture
- Component responsibilities and interfaces
- Data models and error handling strategies
- Testing strategy and deployment architecture

### [Requirements](.kiro/specs/ranvier-mud-browser-client/requirements.md)
**Feature requirements and acceptance criteria** - What the system should do.

**Contents:**
- 8 major requirements with acceptance criteria
- User stories for different system capabilities
- Browser connectivity, character persistence, gameplay mechanics
- Combat system, NPC interactions, containerization

### [Implementation Tasks](.kiro/specs/ranvier-mud-browser-client/tasks.md)
**Development progress tracking** - Detailed task breakdown and status.

**Contents:**
- Task breakdown for all major features
- Progress tracking with checkboxes
- Requirements mapping for each task
- Implementation details and testing requirements

### [Technology Stack](.kiro/steering/tech.md)
**Technology choices and justifications** - Core technologies and deployment strategy.

**Contents:**
- Core technologies (Ranvier, Node.js, xterm.js, Docker)
- Key libraries and frameworks
- Development environment and deployment approaches
- Testing strategy and port configurations

### [Product Overview](.kiro/steering/product.md)
**High-level product vision** - What zev-mud is and who it's for.

**Contents:**
- Product concept and core features
- Target audience and use cases
- Architecture approach and design philosophy

### [Project Structure](.kiro/steering/structure.md)
**Code organization and boundaries** - How the project is organized.

**Contents:**
- Directory structure and file organization
- Component boundaries and responsibilities
- Naming conventions and code patterns
- Data flow and configuration management

## Issue Templates (.github/ISSUE_TEMPLATE/)

Specialized issue templates for different types of contributors:

- **architect_product_manager.md** - Strategic planning and architecture decisions
- **developer_*.md** - Bug fixes, features, and refactoring
- **designer_agent.md** - UI/UX design and user experience
- **devops_engineer_agent.md** - Infrastructure and deployment
- **historian_technical_writer.md** - Documentation and knowledge management
- **qa_tester_agent.md** - Testing and quality assurance
- **security_guardian_agent.md** - Security review and hardening
- **data_analyst_agent.md** - Analytics and performance analysis

## Documentation Maintenance

### Keeping Documentation Current

**Regular Reviews:**
- Monthly review of all README files
- Quarterly review of API documentation
- Update documentation with each major release
- Cross-reference code changes with documentation

**Update Triggers:**
- New features or components added
- API changes or breaking changes
- Configuration option changes
- Architecture or deployment changes

### Documentation Standards

**Style Guidelines:**
- Use clear, concise language
- Include practical examples and code snippets
- Maintain consistent formatting and structure
- Link between related documents
- Keep audience in mind for each document

**Content Requirements:**
- All public APIs must be documented
- All configuration options must be explained
- Installation and setup procedures must be complete
- Troubleshooting sections for common issues

### Contributing to Documentation

**For Documentation Updates:**
1. Follow the same pull request process as code changes
2. Test all instructions and examples
3. Review for clarity and completeness
4. Update the documentation index if adding new files

**For New Documentation:**
1. Consider the target audience
2. Follow existing documentation patterns
3. Include in this index file
4. Cross-reference from relevant documents

## Quick Reference

**Getting Started:**
1. Read [README.md](README.md) for project overview
2. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for development setup
3. Reference [API.md](API.md) for technical integration
4. Use [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment

**For Different Roles:**
- **New Players:** README.md → Quick Start section
- **New Developers:** CONTRIBUTING.md → Development Setup
- **System Admins:** DEPLOYMENT.md → Production Setup
- **API Users:** API.md → relevant component section
- **Contributors:** CONTRIBUTING.md → workflow and standards

**Architecture Understanding:**
- High-level: README.md Architecture section
- Detailed: .kiro/specs/ranvier-mud-browser-client/design.md
- Implementation: Component README files
- Historical context: .kiro/ specifications

This documentation system provides comprehensive coverage for all aspects of the zev-mud project, from initial setup to advanced deployment and maintenance.