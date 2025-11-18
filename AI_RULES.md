# AI Development Rules

This document outlines the technical stack and specific rules for developing this application. Following these guidelines ensures consistency, maintainability, and leverages the strengths of our chosen libraries.

## Tech Stack

This project is built with a modern, type-safe, and efficient stack:

-   **Framework**: React with TypeScript for building a type-safe user interface.
-   **Build Tool**: Vite for fast development and optimized builds.
-   **Styling**: Tailwind CSS for a utility-first styling approach.
-   **UI Components**: `shadcn/ui` for a comprehensive library of accessible and customizable components.
-   **Routing**: React Router (`react-router-dom`) for client-side navigation.
-   **Data Fetching**: TanStack Query (`@tanstack/react-query`) for managing server state, caching, and data fetching.
-   **Forms**: React Hook Form with Zod for robust and type-safe form handling and validation.
-   **Icons**: Lucide React for a clean and consistent set of icons.
-   **Notifications**: Sonner for simple and elegant toast notifications.

## Library Usage Rules

To maintain a clean and consistent codebase, please adhere to the following rules:

### 1. UI and Styling

-   **Component Library**: **Always** use components from `shadcn/ui` (`@/components/ui/*`) when a suitable component exists. Do not build custom components for things like buttons, dialogs, inputs, etc.
-   **Styling**: All styling **must** be done using Tailwind CSS utility classes. Do not write custom CSS files or use inline `style` objects unless absolutely necessary.
-   **Conditional Classes**: Use the `cn` utility from `@/lib/utils.ts` to merge and apply conditional Tailwind classes.

### 2. Routing and Navigation

-   **Router**: Use `react-router-dom` for all routing.
-   **Route Definitions**: All top-level routes must be defined in `src/App.tsx`.
-   **Navigation**: Use the `<Link>` component from `react-router-dom` for internal navigation. For navigation within components that need active/pending styles, use the custom `NavLink` component from `@/components/NavLink.tsx`.

### 3. State Management

-   **Server State**: For any data fetched from an API, use `@tanstack/react-query`. This handles caching, refetching, and loading/error states automatically.
-   **Client State**: For simple, component-level state, use React's built-in hooks (`useState`, `useReducer`). Avoid complex global state management libraries unless the application's complexity justifies it.

### 4. Forms

-   **Form Handling**: For all forms with more than one input, use `react-hook-form`.
-   **Validation**: Use `zod` to define validation schemas and connect them to `react-hook-form` using `@hookform/resolvers/zod`.

### 5. Icons and Notifications

-   **Icons**: Exclusively use icons from the `lucide-react` library.
-   **Toasts**: Use `sonner` for all toast notifications. The `Toaster` is already configured in `src/App.tsx`. Import and use the `toast()` function from `sonner` where needed.

### 6. File Structure

-   **Pages**: Place all page-level components in `src/pages/`.
-   **Reusable Components**: Place all custom, reusable components in `src/components/`.
-   **Hooks**: Custom hooks should be placed in `src/hooks/`.
-   **Utilities**: General utility functions should be placed in `src/lib/`.