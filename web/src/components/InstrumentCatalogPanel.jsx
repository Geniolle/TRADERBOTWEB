import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api/v1";

export default function InstrumentCatalogPanel({ onCatalogChange }) {
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [typeData, setTypeData] = useState(null);
  const [selectedCatalog, setSelectedCatalog] = useState("");
  const [error, setError] = useState("");
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTypes() {
      setLoadingTypes(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/catalog/products`);
        if (!response.ok) {
          throw new Error(`Erro ao carregar tipos: ${response.status}`);
        }

        const data = await response.json();
        if (cancelled) return;

        const list = Array.isArray(data.products) ? data.products : [];
        setTypes(list);

        if (list.length > 0) {
          setSelectedType(list[0].code);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Erro ao carregar tipos.");
        }
      } finally {
        if (!cancelled) {
          setLoadingTypes(false);
        }
      }
    }

    loadTypes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedType) {
      setTypeData(null);
      setSelectedCatalog("");
      return;
    }

    let cancelled = false;

    async function loadTypeData() {
      setLoadingCatalogs(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/catalog/products/${selectedType}`);
        if (!response.ok) {
          throw new Error(`Erro ao carregar catálogos: ${response.status}`);
        }

        const data = await response.json();
        if (cancelled) return;

        setTypeData(data);

        const firstCatalog = data?.subproducts?.[0]?.code || "";
        setSelectedCatalog(firstCatalog);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Erro ao carregar catálogos.");
          setTypeData(null);
          setSelectedCatalog("");
        }
      } finally {
        if (!cancelled) {
          setLoadingCatalogs(false);
        }
      }
    }

    loadTypeData();

    return () => {
      cancelled = true;
    };
  }, [selectedType]);

  useEffect(() => {
    if (!selectedType || !selectedCatalog) return;

    if (typeof onCatalogChange === "function") {
      onCatalogChange({
        type: selectedType,
        catalog: selectedCatalog,
      });
    }
  }, [selectedType, selectedCatalog, onCatalogChange]);

  const catalogs = useMemo(() => {
    return Array.isArray(typeData?.subproducts) ? typeData.subproducts : [];
  }, [typeData]);

  return (
    <section className="catalog-panel">
      <div className="catalog-panel__header">
        <h3>Mercado</h3>
        <p>Escolhe o tipo e depois o catálogo.</p>
      </div>

      {error ? <div className="catalog-panel__error">{error}</div> : null}

      <div className="catalog-panel__field">
        <label htmlFor="market-type">Tipo</label>
        <select
          id="market-type"
          value={selectedType}
          onChange={(event) => setSelectedType(event.target.value)}
          disabled={loadingTypes || types.length === 0}
        >
          {types.map((type) => (
            <option key={type.code} value={type.code}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="catalog-panel__field">
        <label htmlFor="market-catalog">Catálogo</label>
        <select
          id="market-catalog"
          value={selectedCatalog}
          onChange={(event) => setSelectedCatalog(event.target.value)}
          disabled={loadingCatalogs || catalogs.length === 0}
        >
          {catalogs.map((catalog) => (
            <option key={catalog.code} value={catalog.code}>
              {catalog.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}