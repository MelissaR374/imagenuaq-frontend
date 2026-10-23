//TARJETA DE ESTADÍSTICAS DE FACTURACIÓN-INDICADORES
function BillingStatCard({
  title,
  value,
  description,
  icon: Icon,
  format = "number",
}) {
  const displayedValue =
    format === "currency"
      ? new Intl.NumberFormat("es-MX", {
          style: "currency",
          currency: "MXN",
          maximumFractionDigits: 0,
        }).format(value)
      : value;

  return (
    <article className="billing-stat-card">
      <div className="billing-stat-content">
        <span className="billing-stat-title">{title}</span>

        <strong className="billing-stat-value">
          {displayedValue}
        </strong>

        <span className="billing-stat-description">
          {description}
        </span>
      </div>

      <div className="billing-stat-icon">
        <Icon />
      </div>
    </article>
  );
}

export default BillingStatCard;