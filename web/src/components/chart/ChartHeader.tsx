// web/src/components/chart/ChartHeader.tsx

type ChartHeaderProps = {
  title: string;
};

function ChartHeader({ title }: ChartHeaderProps) {
  return (
    <h2
      style={{
        marginTop: 0,
        marginBottom: 16,
        textAlign: "center",
        fontSize: 22,
        fontWeight: 700,
        color: "#0f172a",
      }}
    >
      {title}
    </h2>
  );
}

export default ChartHeader;