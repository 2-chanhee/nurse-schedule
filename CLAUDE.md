# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a nurse scheduling application built with React 19, TypeScript, and Vite. The project is in its early stages with a minimal Vite + React setup.

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server with HMR
npm run preview      # Preview production build locally
```

### Building
```bash
npm run build        # Type-check with TypeScript and build for production
```

The build process runs `tsc -b` for type checking before `vite build`. Both must pass for a successful build.

### Code Quality
```bash
npm run lint         # Run ESLint on all TypeScript/TSX files
```

## TypeScript Configuration

The project uses TypeScript project references with two separate configs:
- `tsconfig.app.json`: Application code in `src/` (strict mode enabled)
- `tsconfig.node.json`: Build tooling and configuration files

The main `tsconfig.json` orchestrates these references. When type-checking, both configs are validated.

TypeScript strict mode is enabled with additional strict linting rules:
- `noUnusedLocals`
- `noUnusedParameters`
- `noFallthroughCasesInSwitch`
- `noUncheckedSideEffectImports`
- `erasableSyntaxOnly`

## ESLint Configuration

Uses flat config format (`eslint.config.js`) with:
- `@typescript-eslint/eslint-plugin` for TypeScript rules
- `eslint-plugin-react-hooks` for React Hooks rules
- `eslint-plugin-react-refresh` for Vite Fast Refresh compatibility

The configuration targets `**/*.{ts,tsx}` files and ignores the `dist` directory.

## Architecture

### Entry Point
- `src/main.tsx`: Application entry point that renders the root `<App />` component wrapped in `<StrictMode>`

### Module System
- Uses ES modules (`type: "module"` in package.json)
- Vite handles bundling with React plugin for Fast Refresh
- TSX files use `jsx: "react-jsx"` transform (no React import needed)

### Development Philosophy
The project name suggests this will be a nurse scheduling application, but currently contains only boilerplate. Future development will likely involve:
- Schedule management components
- Nurse shift assignment logic
- Calendar/timeline visualizations
- Data persistence layer
