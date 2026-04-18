import { useEffect, useMemo, useState } from "react";

import DashboardPage from "./pages/DashboardPage";
import StageTestsPage from "./pages/StageTestsPage";

function getCurrentPathname(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function App() {
  const [pathname, setPathname] = useState<string>(() => getCurrentPathname());

  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(getCurrentPathname());
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  const normalizedPathname = useMemo(() => {
    if (pathname === "/stage-tests") return "/stage-tests";
    return "/";
  }, [pathname]);

  return normalizedPathname === "/stage-tests" ? (
    <StageTestsPage />
  ) : (
    <DashboardPage />
  );
}

export default App;
