export const metadata = {
  title: "Eliminar mis datos · W Capital",
  description:
    "Instrucciones para solicitar la eliminación de tus datos personales en W Capital.",
};

// Forzado a dinámico para que reciba el nonce de CSP por request (ver src/proxy.ts)
export const dynamic = "force-dynamic";

const LAST_UPDATED = "16 de agosto de 2026";

export default function EliminarDatosPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-line-2 bg-surface px-4 py-5">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-linear-150 from-[#FF7A56] to-[#F04A1F] font-serif text-[22px] leading-none italic text-white shadow-[0_6px_16px_-6px_rgba(247,91,50,.75)]">
            W
          </div>
          <div className="leading-tight">
            <p className="font-semibold tracking-[-.01em]">W Capital</p>
            <p className="text-[11px] tracking-[.09em] uppercase text-ink-3">
              Eliminar mis datos
            </p>
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-2xl px-4 py-10 text-[14.5px] leading-[1.7] text-ink">
        <h1 className="font-serif text-[32px] font-normal leading-[1.15] tracking-[-.01em] text-ink">
          Cómo eliminar tus datos
        </h1>
        <p className="mt-2 text-[12.5px] text-ink-3">
          Última actualización: {LAST_UPDATED}
        </p>

        <Section title="1. Cómo solicitarlo">
          <p>
            Si nos escribió por WhatsApp o Messenger y quiere que eliminemos
            su información de nuestros sistemas, puede solicitarlo de
            cualquiera de estas dos formas:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Envíe el mensaje <strong>&ldquo;Borrar mis datos&rdquo;</strong>{" "}
              por el mismo WhatsApp o Messenger donde nos contactó.
            </li>
            <li>
              Llame al teléfono{" "}
              <a href="tel:+526622125007" className="font-medium text-brand hover:underline">
                662 212 5007
              </a>{" "}
              y solicítelo directamente con nuestro equipo.
            </li>
          </ul>
        </Section>

        <Section title="2. Qué pasa después">
          <p>
            Verificaremos su identidad para proteger su información contra
            solicitudes fraudulentas, y le confirmaremos su solicitud.
            Atenderemos su petición en un plazo máximo de 20 días hábiles,
            conforme a lo establecido por la Ley Federal de Protección de
            Datos Personales en Posesión de los Particulares.
          </p>
        </Section>

        <Section title="3. Excepciones">
          <p>
            Si usted tiene una solicitud de crédito o un préstamo activo con
            nosotros, o si la ley nos obliga a conservar cierta información
            (por ejemplo, para fines fiscales, contables o de cumplimiento
            normativo), conservaremos únicamente los datos estrictamente
            necesarios durante el tiempo que la ley exija, y eliminaremos el
            resto. Le explicaremos con claridad qué se elimina y qué se
            conserva, y por qué.
          </p>
        </Section>

        <Section title="4. Contacto">
          <p>
            W Capital S.A. de C.V.
            <br />
            Av. Luis Donaldo Colosio 158, Local 6 (dentro de Plaza Universitaria),
            C.P. 83260, Hermosillo, Sonora, México
            <br />
            Teléfono:{" "}
            <a href="tel:+526622125007" className="font-medium text-brand hover:underline">
              662 212 5007
            </a>
          </p>
        </Section>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-[16px] font-semibold tracking-[-.01em] text-ink">
        {title}
      </h2>
      <div className="mt-2 text-ink-2">{children}</div>
    </section>
  );
}
