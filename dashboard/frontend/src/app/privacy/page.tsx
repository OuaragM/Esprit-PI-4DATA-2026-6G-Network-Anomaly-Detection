export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px", color: "var(--fg)" }}>
      <h1 style={{ marginTop: 0 }}>Politique de confidentialite</h1>
      <p>
        Cette page decrit comment Verado collecte, traite et protege les informations
        necessaires au fonctionnement de la plateforme.
      </p>
      <h2>Donnees collectees</h2>
      <p>
        Nous collectons uniquement les informations utiles a l'authentification,
        l'exploitation de la plateforme et la supervision du systeme.
      </p>
      <h2>Utilisation des donnees</h2>
      <p>
        Les donnees sont utilisees pour l'analyse IDS, la visualisation des resultats
        et l'amelioration continue des modeles.
      </p>
      <h2>Securite</h2>
      <p>
        La plateforme applique des mecanismes de securite standards (authentification,
        controle d'acces, journalisation et surveillance).
      </p>
    </main>
  );
}
