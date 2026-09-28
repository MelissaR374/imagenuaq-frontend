import {
    MdKeyboardArrowDown,
    MdEdit,
    MdArrowDownward,
} from "react-icons/md";

import "./FlowCard.css";


function FlowCard({
    area,
    title,
    person,
    initials,
    input,
    output,
    days,
    active = false,
    onEdit,
}) {

    return (
        <article
            className={`flow-card ${active ? "active" : ""}`}
        >

            {/* EDITAR */}

            <button
                type="button"
                className="flow-card-edit"
                title="Editar área"
                onClick={() => onEdit?.()}
            >
                <MdEdit />
            </button>

            <span className="flow-card-area">
                {area}
            </span>

            <h3>
                {title}
            </h3>

            <div className="flow-person">

                <span className="person-avatar">
                    {initials}
                </span>

                <span className="person-name">
                    {person}
                </span>

                <MdKeyboardArrowDown />

            </div>


            {/* ENTRADA / SALIDA */}

            <div className="flow-io">

                <div>

                    <span>
                        ENTRA
                    </span>

                    <p>
                        {input}
                    </p>

                </div>


                <div>

                    <span>
                        SALE
                    </span>

                    <p>
                        {output}
                    </p>

                </div>

            </div>


            {/* DÍAS */}

            <span className="flow-days">
                {days}
            </span>


            {/* CONECTOR */}

            {/* <span className="flow-connector">
                <MdArrowDownward />
            </span> */}

        </article>
    );
}


export default FlowCard;