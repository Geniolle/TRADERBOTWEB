import type { ReactNode } from "react";

type AppPath = "/" | "/stage-tests";

type Props = {
  sectionLabel: string;
  activePath: AppPath;
  sidebarWidth?: number;
  sidebarBody?: ReactNode;
  mainPadding?: number;
  children: ReactNode;
};

function NavLink({
  href,
  label,
  active,
}: {
  href: AppPath;
  label: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      style={{
        display: "block",
        padding: "10px 12px",
        borderRadius: 10,
        textDecoration: "none",
        fontSize: 14,
        fontWeight: 600,
        color: active ? "#0f172a" : "#475569",
        background: active ? "#eef2ff" : "transparent",
        border: active ? "1px solid #c7d2fe" : "1px solid transparent",
      }}
    >
      {label}
    </a>
  );
}

export default function AppShell({
  sectionLabel,
  activePath,
  sidebarWidth = 220,
  sidebarBody,
  mainPadding = 24,
  children,
}: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "stretch",
        }}
      >
        <aside
          style={{
            width: sidebarWidth,
            minWidth: sidebarWidth,
            maxWidth: sidebarWidth,
            borderRight: "1px solid #dbe2ea",
            background: "#ffffff",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "24px 20px 16px 20px",
                borderBottom: "1px solid #eef2f7",
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: 34,
                  fontWeight: 700,
                  color: "#0f172a",
                  lineHeight: 1.1,
                }}
              >
                Trader Bot
              </h1>
              <p
                style={{
                  margin: "8px 0 0 0",
                  color: "#475569",
                  fontSize: 15,
                }}
              >
                {sectionLabel}
              </p>
            </div>

            <div
              style={{
                padding: "12px 16px 0 16px",
                display: "grid",
                gap: 8,
              }}
            >
              <NavLink href="/" label="Dashboard" active={activePath === "/"} />
              <NavLink
                href="/stage-tests"
                label="Stage Tests"
                active={activePath === "/stage-tests"}
              />
            </div>

            {sidebarBody ? (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: 16,
                  boxSizing: "border-box",
                }}
              >
                {sidebarBody}
              </div>
            ) : null}
          </div>
        </aside>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            boxSizing: "border-box",
            padding: mainPadding,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
