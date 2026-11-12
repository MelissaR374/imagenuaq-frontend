// The landing screen: what Imagen UAQ is and a card for every tab this user can open, so a new
// account sees where to start. A user with no work permissions yet is told whom to ask.
import { menuSections, itemVisible, descripciones } from "../sidebar/menu.js";

import "./home.css";

/** @param {{ user: { fullName?: string }, role: string, permissions: string[], onNavigate: (label: string) => void }} props */
function Home({ user, role, permissions, onNavigate }) {
  const sections = menuSections
    .map((section) => ({
      title: section.title ?? "General",
      items: section.items.filter(
        (item) => item.label !== "Inicio" && itemVisible(item, role, permissions),
      ),
    }))
    .filter((section) => section.items.length > 0);

  const firstName = user.fullName?.trim().split(" ")[0] ?? "";
  const onlyGeneral = sections.every((section) => section.title === "General");

  return (
    <section className="home">
      <header className="home-header">
        <h2 className="home-greeting">Hola{firstName ? `, ${firstName}` : ""}</h2>
        <p className="home-intro">
          Imagen UAQ reúne en un solo lugar las solicitudes, los proyectos, los archivos, las
          ausencias y los cobros de la coordinación.
        </p>
        {onlyGeneral ? (
          <p className="home-notice">
            Tu cuenta todavía no tiene permisos para las pantallas de trabajo. Pide a la
            coordinación que te asigne un rol o un área.
          </p>
        ) : null}
        <p className="home-tip">
          Puedes reordenar las pestañas del menú arrastrándolas, o con Alt + ↑/↓.
        </p>
      </header>

      {sections.map((section) => (
        <div className="home-section" key={section.title}>
          <h3 className="home-section-title">{section.title}</h3>
          <ul className="home-cards">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <button className="home-card" type="button" onClick={() => onNavigate(item.label)}>
                    <Icon className="home-card-icon" />
                    <span className="home-card-label">{item.label}</span>
                    {descripciones[item.label] ? (
                      <span className="home-card-description">{descripciones[item.label]}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

export default Home;
