import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NovoPlanejamentoIA from "./pages/NovoPlanejamentoIA";
import PlanoDeTratamento from "./pages/PlanoDeTratamento";
import TermoDeCompromisso from "./pages/TermoDeCompromisso";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RequirePermission } from "./components/RequirePermission";
import Login from "./pages/Login";
import AccessDenied from "./pages/AccessDenied";

const queryClient = new QueryClient();

import { ClinicProvider } from "./context/ClinicContext";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <ClinicProvider>
          <BrowserRouter>
            <Routes>
              {/* Routes... */}
              <Route path="/login" element={<Login />} />
              <Route path="/access-denied" element={<AccessDenied />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Dashboard />} />

                <Route element={<RequirePermission action="read" resource="patient" />}>
                  <Route path="/patients" element={<Patients />} />
                  <Route path="/patients/:id" element={<PatientDetail />} />
                </Route>

                <Route element={<RequirePermission action="write" resource="planning" />}>
                  <Route path="/novo-planejamento" element={<NovoPlanejamentoIA />} />
                  <Route path="/plano-de-tratamento" element={<PlanoDeTratamento />} />
                </Route>

                <Route element={<RequirePermission action="write" resource="contract" />}>
                  <Route path="/termo-de-compromisso" element={<TermoDeCompromisso />} />
                </Route>
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ClinicProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;