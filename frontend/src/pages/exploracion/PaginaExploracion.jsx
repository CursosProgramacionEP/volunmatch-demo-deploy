import { useEffect, useState } from "react";
import { Leaf, Search, Sparkles } from "lucide-react";
import { Loader } from "../../components/comunes/Cargador.jsx";
import { EmptyState } from "../../components/comunes/EstadoVacio.jsx";
import { InitiativeCard } from "../../components/iniciativas/TarjetaIniciativa.jsx";
import { api } from "../../services/cliente-api.js";
import { categories } from "../../constants/aplicacion.js";

/**
 * Pantalla del voluntario para explorar, buscar y filtrar iniciativas disponibles.
 *
 * @param {{token: string, onOpen: Function, showNotice: Function}} props Token de autenticación, callback para abrir una iniciativa y función para mostrar avisos.
 * @returns {JSX.Element} Interfaz de exploración de iniciativas.
 */
export function ExplorePage({ token, onOpen, showNotice }) {
  const [initiatives, setInitiatives] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /**
   * Carga las iniciativas desde el backend cada vez que cambia el token,
   * la búsqueda o la categoría seleccionada.
   *
   * Utiliza una bandera "active" para evitar actualizar el estado si el
   * componente se desmonta antes de que la petición finalice.
   *
   * @returns {void}
   */
  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .initiatives(token, { search: query, category })
      .then((response) => {
        if (active) setInitiatives(response.initiatives);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token, query, category]);

  return (
    <section className="workspace-content explore-page">
      <div className="page-title">
        <div>
          <p className="section-kicker">ENCUENTRA TU CAUSA</p>
          <h1>Iniciativas disponibles</h1>
          <p>
            Explora oportunidades cercanas y da el primer paso para generar
            impacto.
          </p>
        </div>
        <span className="page-title__badge">
          <Leaf size={18} />
          {initiatives.length} activas
        </span>
      </div>

      <div className="explore-toolbar">
        <label className="search-box">
          <Search size={20} />
          <input
            placeholder="Buscar iniciativas, empresas o categorías..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="category-pills">
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <Loader />
      ) : initiatives.length ? (
        <div className="initiative-grid">
          {initiatives.map((initiative) => (
            <InitiativeCard
              key={initiative.id}
              initiative={initiative}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No encontramos iniciativas"
          text="Prueba con otra búsqueda o categoría."
        />
      )}

      <div className="explore-note">
        <Sparkles size={18} />
        <span>
          ¿No ves la causa que buscas? Vuelve pronto: las empresas publican
          nuevas iniciativas cada semana.
        </span>
      </div>
    </section>
  );
}
