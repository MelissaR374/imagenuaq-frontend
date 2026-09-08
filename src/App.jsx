import React from "react"
import Sidebar from "./components/sidebar/sidebar";
import "./App.css";

function App() {
  return (
    <div className="app-container">

      <Sidebar
        role="lider"
        activeItem="Proyectos"
        onNavigate={(item) => {
          console.log("Seleccionaste:", item);
        }}
      />

      <main className="main-content">
        <h1>Proyectos</h1>
      </main> 

    </div>
  );
}

export default App;