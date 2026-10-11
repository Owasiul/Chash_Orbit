# Field Shift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-quality web app for NASA Space Apps Challenge 2026 - Field Shift that helps farmers make data-driven crop rotation decisions using real NASA Earth observation data.

**Architecture:** Modular full-stack application with Next.js 14+ frontend (React + TypeScript + Shadcn UI) and Python/FastAPI backend. Features real-time NASA API integration (POWER, SMAP, GPM) with caching, localStorage persistence for farm data/plans, and responsive mobile-first design.

**Tech Stack:** 
- Frontend: Next.js 14+, TypeScript, React, Shadcn UI, Tailwind CSS, React Hook Form, Zod, Recharts, React-Leaflet/Leaflet, SWR
- Backend: FastAPI, Python 3.9+, Pydantic, Uvicorn, Python-dotenv, Requests, EarthAccess (for SMAP/GPM)
- Dev: Git, ESLint, Prettier, Jest/React Testing Library, Pytest

**Spec:** docs/superpowers/specs/2026-10-06-field-shift-design.md

## Global Constraints

- Real NASA API calls only (no fallback to sample data) - per user requirement
- Mobile-first responsive design (works at 390×844)
- NASA data attribution visible on all charts/maps
- Persist farm + plans in localStorage (no authentication)
- Ship with 4 pre-configured sample farms for demo
- First useful paint < 2s on sample farm
- Accessibility: WCAG AA contrast, keyboard navigation, ARIA labels
- No broken interactions, no placeholder "lorem" copy
- Touch-friendly: 44px minimum touch targets

## Review Focus

- API rate limiting: Ensure NASA API calls respect rate limits through caching
- Error handling: Graceful degradation when APIs fail (clear error messages, no fallback)
- Data validation: Validate all API responses before use in calculations
- Performance: Optimize chart rendering and data processing for smooth UI
- Cross-browser compatibility: Test on Chrome, Firefox, Safari (mobile/desktop)
- Accessibility: Screen reader support, color contrast, keyboard navigation
- Mobile touch targets: Minimum 44px for all interactive elements
- Data freshness: Appropriate caching strategies for different data types

---