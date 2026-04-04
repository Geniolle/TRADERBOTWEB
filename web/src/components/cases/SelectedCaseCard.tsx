// web/src/components/cases/SelectedCaseCard.tsx

import { formatDateTime } from "../../utils/format";
import type { RunDetailsResponse, RunCaseMetadata } from "../../types/trading";

type SelectedCaseCardProps = {
  mainCardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  runDetails: RunDetailsResponse | null;
  selectedCaseId: string;
};

function readMetadata(selectedCase: { metadata?: RunCaseMetadata }) {
  return selectedCase.metadata ?? {};
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 14,
        marginBottom: 8,
        fontSize: 15,
        fontWeight: 700,
        color: "#0f172a",
      }}
    >
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <strong>{label}:</strong> {value ?? "-"}
    </div>
  );
}

function BoolBadge({ value }: { value: boolean | null | undefined }) {
  if (value === true) {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 999,
          background: "#dcfce7",
          color: "#166534",
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        true
      </span>
    );
  }

  if (value === false) {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 999,
          background: "#fee2e2",
          color: "#991b1b",
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        false
      </span>
    );
  }

  return <>-</>;
}

function SelectedCaseCard({
  mainCardStyle,
  sectionTitleStyle,
  runDetails,
  selectedCaseId,
}: SelectedCaseCardProps) {
  const selectedCase =
    runDetails?.cases.find((item) => item.id === selectedCaseId) ?? null;

  const metadata = selectedCase ? readMetadata(selectedCase) : {};
  const snapshot = metadata.analysis_snapshot;

  return (
    <div style={mainCardStyle}>
      <h2 style={sectionTitleStyle}>Case selecionado</h2>

      {!selectedCase && <p>Nenhum case selecionado.</p>}

      {selectedCase && (
        <div style={{ display: "grid", gap: 8, fontSize: 14, color: "#334155" }}>
          <InfoRow label="ID" value={selectedCase.id} />
          <InfoRow label="Status" value={selectedCase.status} />
          <InfoRow label="Outcome" value={selectedCase.outcome ?? "-"} />
          <InfoRow label="Entry Price" value={selectedCase.entry_price} />
          <InfoRow label="Target Price" value={selectedCase.target_price} />
          <InfoRow label="Invalidation Price" value={selectedCase.invalidation_price} />
          <InfoRow label="Close Price" value={selectedCase.close_price ?? "-"} />
          <InfoRow label="Trigger Time" value={formatDateTime(selectedCase.trigger_time ?? null)} />
          <InfoRow label="Entry Time" value={formatDateTime(selectedCase.entry_time ?? null)} />
          <InfoRow label="Close Time" value={formatDateTime(selectedCase.close_time ?? null)} />
          <InfoRow label="Bars To Resolution" value={selectedCase.bars_to_resolution} />
          <InfoRow label="MFE" value={selectedCase.max_favorable_excursion} />
          <InfoRow label="MAE" value={selectedCase.max_adverse_excursion} />
          <InfoRow label="Setup Type" value={metadata.setup_type ?? "-"} />
          <InfoRow label="Trade Bias" value={metadata.trade_bias ?? "-"} />
          <InfoRow label="Close Reason" value={metadata.close_reason ?? "-"} />

          {snapshot && (
            <>
              <SectionTitle>Contexto</SectionTitle>
              <InfoRow label="Session" value={snapshot.trigger_context?.session ?? "-"} />
              <InfoRow label="Day" value={snapshot.trigger_context?.day_of_week ?? "-"} />
              <InfoRow label="Hour" value={snapshot.trigger_context?.hour_of_day ?? "-"} />

              <SectionTitle>Tendência</SectionTitle>
              <InfoRow label="EMA Alignment" value={snapshot.trend?.ema_alignment ?? "-"} />
              <InfoRow label="Price vs EMA 20" value={snapshot.trend?.price_vs_ema_20 ?? "-"} />
              <InfoRow label="Price vs EMA 40" value={snapshot.trend?.price_vs_ema_40 ?? "-"} />
              <InfoRow label="EMA 5 Slope" value={snapshot.trend?.ema_5_slope ?? "-"} />
              <InfoRow label="EMA 10 Slope" value={snapshot.trend?.ema_10_slope ?? "-"} />
              <InfoRow label="EMA 20 Slope" value={snapshot.trend?.ema_20_slope ?? "-"} />
              <InfoRow label="EMA 30 Slope" value={snapshot.trend?.ema_30_slope ?? "-"} />
              <InfoRow label="EMA 40 Slope" value={snapshot.trend?.ema_40_slope ?? "-"} />

              <SectionTitle>Momentum</SectionTitle>
              <InfoRow label="RSI 14" value={snapshot.momentum?.rsi_14 ?? "-"} />
              <InfoRow label="RSI Zone" value={snapshot.momentum?.rsi_zone ?? "-"} />
              <InfoRow label="RSI Slope" value={snapshot.momentum?.rsi_slope ?? "-"} />
              <InfoRow label="MACD State" value={snapshot.momentum?.macd_state ?? "-"} />
              <InfoRow
                label="MACD Histogram Slope"
                value={snapshot.momentum?.macd_histogram_slope ?? "-"}
              />

              <SectionTitle>Bollinger</SectionTitle>
              <InfoRow label="Upper" value={snapshot.bollinger?.upper ?? "-"} />
              <InfoRow label="Middle" value={snapshot.bollinger?.middle ?? "-"} />
              <InfoRow label="Lower" value={snapshot.bollinger?.lower ?? "-"} />
              <InfoRow label="Bandwidth" value={snapshot.bollinger?.bandwidth ?? "-"} />

              <SectionTitle>Estrutura</SectionTitle>
              <InfoRow
                label="Market Structure"
                value={snapshot.structure?.market_structure ?? "-"}
              />
              <InfoRow label="Entry Location" value={snapshot.structure?.entry_location ?? "-"} />
              <InfoRow
                label="Distance to Support"
                value={snapshot.structure?.distance_to_recent_support ?? "-"}
              />
              <InfoRow
                label="Distance to Resistance"
                value={snapshot.structure?.distance_to_recent_resistance ?? "-"}
              />

              <SectionTitle>Candle de Trigger</SectionTitle>
              <InfoRow
                label="Candle Type"
                value={snapshot.trigger_candle?.candle_type ?? "-"}
              />
              <InfoRow label="Body Ratio" value={snapshot.trigger_candle?.body_ratio ?? "-"} />
              <InfoRow label="Upper Wick" value={snapshot.trigger_candle?.upper_wick ?? "-"} />
              <InfoRow label="Lower Wick" value={snapshot.trigger_candle?.lower_wick ?? "-"} />

              <SectionTitle>Patterns</SectionTitle>
              <InfoRow
                label="BB Reentry Long"
                value={<BoolBadge value={snapshot.patterns?.bb_reentry_long} />}
              />
              <InfoRow
                label="BB Reentry Short"
                value={<BoolBadge value={snapshot.patterns?.bb_reentry_short} />}
              />
              <InfoRow
                label="EMA Trend Confirmed Long"
                value={<BoolBadge value={snapshot.patterns?.ema_trend_confirmed_long} />}
              />
              <InfoRow
                label="EMA Trend Confirmed Short"
                value={<BoolBadge value={snapshot.patterns?.ema_trend_confirmed_short} />}
              />
              <InfoRow
                label="RSI Recovery Long"
                value={<BoolBadge value={snapshot.patterns?.rsi_recovery_long} />}
              />
              <InfoRow
                label="MACD Confirmation Long"
                value={<BoolBadge value={snapshot.patterns?.macd_confirmation_long} />}
              />
              <InfoRow
                label="Countertrend Long"
                value={<BoolBadge value={snapshot.patterns?.countertrend_long} />}
              />
              <InfoRow
                label="Countertrend Short"
                value={<BoolBadge value={snapshot.patterns?.countertrend_short} />}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default SelectedCaseCard;