// «Organigrama»: every area drawn as a top-down tree, each box with its people and their photos, the
// responsible ones first; whoever belongs to no area is listed below so nobody drops off the chart.
// Photos need the bearer token, so each is fetched once and shown through an object URL.
import { useEffect, useState } from "react";
import { MdPrint } from "react-icons/md";
import { Tree, TreeNode } from "react-organizational-chart";

import * as api from "../../api/client.js";
import { initials } from "../shared/format.js";
import "./orgChart.css";

const USERS_MAX = 200;

/** The server names the roles in English; the same names users.jsx shows. */
const ROLE_NAMES = {
  admin: "Coordinación",
  area_lead: "Responsable de área",
  worker: "Integrante",
  finance: "Finanzas",
};

/** The id of everybody who belongs to some area in the forest, to tell who belongs to none. */
function memberIds(nodes, out = new Set()) {
  for (const node of nodes) {
    for (const member of node.members) out.add(member.id);
    memberIds(node.children, out);
  }
  return out;
}

/**
 * One person with their photo; clicking opens their card as a native popover, which sits above the
 * scrolling tree and closes on Escape or a click outside. `scope` keeps the id unique, since one
 * person can be in several areas.
 */
function Person({ person, picture, scope }) {
  const cardId = `org-card-${scope}-${person.id}`;

  return (
    <li className={`org-person ${person.isAreaLeader ? "is-lead" : ""}`}>
      <button className="org-person-button" type="button" popoverTarget={cardId}>
        {picture ? (
          <img className="org-photo" src={picture} alt="" />
        ) : (
          <span className="org-initials">{initials(person.fullName)}</span>
        )}
        <span className="org-who">
          <span className="org-name">{person.fullName}</span>
          {person.isAreaLeader ? <span className="org-tag">Responsable</span> : null}
        </span>
      </button>

      <div className="org-card" id={cardId} popover="auto" aria-label={person.fullName}>
        {picture ? (
          <img className="org-card-photo" src={picture} alt="" />
        ) : (
          <span className="org-card-initials">{initials(person.fullName)}</span>
        )}
        <strong className="org-card-name">{person.fullName}</strong>
        <a className="org-card-email" href={`mailto:${person.email}`}>
          {person.email}
        </a>
        <span className="org-card-role">
          {person.isAreaLeader ? "Responsable del área · " : ""}
          {ROLE_NAMES[person.role] ?? person.role}
        </span>
        <button className="org-card-close" type="button" popoverTarget={cardId} popoverTargetAction="hide">
          Cerrar
        </button>
      </div>
    </li>
  );
}

function People({ people, pictures, scope }) {
  return (
    <ul className="org-people">
      {people.map((person) => (
        <Person key={person.id} person={person} picture={pictures[person.id]} scope={scope} />
      ))}
    </ul>
  );
}

function AreaBox({ area, pictures, root = false }) {
  const people = [...area.members].sort((a, b) => Number(b.isAreaLeader) - Number(a.isAreaLeader));

  return (
    <div className={`org-area ${root ? "is-root" : ""}`}>
      <header className="org-area-header">
        <strong className="org-area-name">{area.name}</strong>
        <span className="org-area-count">{area.memberCount}</span>
      </header>
      {people.length > 0 ? (
        <People people={people} pictures={pictures} scope={area.id} />
      ) : (
        <p className="org-empty">Sin integrantes</p>
      )}
    </div>
  );
}

function Branch({ area, pictures }) {
  return (
    <TreeNode label={<AreaBox area={area} pictures={pictures} />}>
      {area.children.map((child) => (
        <Branch key={child.id} area={child} pictures={pictures} />
      ))}
    </TreeNode>
  );
}

function OrgChart() {
  const [roots, setRoots] = useState(null);
  const [unassigned, setUnassigned] = useState([]);
  const [pictures, setPictures] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const urls = [];

    Promise.all([api.getOrgChart(), api.listUsers({ limit: USERS_MAX })])
      .then(([chart, page]) => {
        if (cancelled) return;
        const inAreas = memberIds(chart.roots);
        setRoots(chart.roots);
        setUnassigned(page.users.filter((person) => !inAreas.has(person.id)));

        for (const person of page.users) {
          api
            .getPicture(person.id)
            .then((blob) => {
              if (cancelled || !blob) return;
              const url = URL.createObjectURL(blob);
              urls.push(url);
              setPictures((current) => ({ ...current, [person.id]: url }));
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  if (error) return <p className="org-error">{error}</p>;
  if (roots === null) return <p className="org-note">Cargando…</p>;

  return (
    <section className="org-chart">
      <div className="org-toolbar print-hide">
        <button className="org-btn" type="button" onClick={() => window.print()}>
          <MdPrint aria-hidden="true" /> Imprimir
        </button>
      </div>

      {roots.length === 0 ? <p className="org-note">Todavía no hay áreas.</p> : null}

      {roots.map((root) => (
        <div className="org-tree" key={root.id}>
          <Tree
            label={<AreaBox area={root} pictures={pictures} root />}
            lineColor="var(--accent-line)"
            lineWidth="1.5px"
            lineHeight="28px"
            lineBorderRadius="10px"
            nodePadding="6px"
          >
            {root.children.map((child) => (
              <Branch key={child.id} area={child} pictures={pictures} />
            ))}
          </Tree>
        </div>
      ))}

      {unassigned.length > 0 ? (
        <div className="org-unassigned">
          <h2 className="org-unassigned-title">Sin área</h2>
          <People people={unassigned} pictures={pictures} scope="none" />
        </div>
      ) : null}
    </section>
  );
}

export default OrgChart;
