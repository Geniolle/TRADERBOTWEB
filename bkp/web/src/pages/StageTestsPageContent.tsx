import StageTestsContent from "./StageTestsPageContent";

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
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

function StageTestsPage() {
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
            width: 220,
            minWidth: 220,
            maxWidth: 220,
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
                Stage Tests
              </p>
            </div>

            <div
              style={{
                padding: 16,
                display: "grid",
                gap: 8,
              }}
            >
              <NavLink href="/" label="Dashboard" active={false} />
              <NavLink href="/stage-tests" label="Stage Tests" active />
            </div>
          </div>
        </aside>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            boxSizing: "border-box",
            padding: 24,
          }}
        >
          <StageTestsContent />
        </main>
      </div>
    </div>
  );
}

export default StageTestsPage;