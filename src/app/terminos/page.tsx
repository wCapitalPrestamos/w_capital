export const metadata = {
  title: "Términos de Servicio · W Capital",
  description:
    "Términos de servicio de W Capital S.A. de C.V. para el uso de nuestro asistente automatizado y canales de atención.",
};

const LAST_UPDATED = "16 de agosto de 2026";

export default function TerminosPage() {
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
              Términos de servicio
            </p>
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-2xl px-4 py-10 text-[14.5px] leading-[1.7] text-ink">
        <h1 className="font-serif text-[32px] font-normal leading-[1.15] tracking-[-.01em] text-ink">
          Términos de Servicio
        </h1>
        <p className="mt-2 text-[12.5px] text-ink-3">
          Última actualización: {LAST_UPDATED}
        </p>

        <Section title="1. Aceptación de estos términos">
          <p>
            Al escribirnos por WhatsApp, Messenger, o utilizar cualquier canal
            digital de <strong>W Capital S.A. de C.V.</strong>
            (&ldquo;W Capital&rdquo;, &ldquo;nosotros&rdquo;), usted acepta
            estos Términos de Servicio. Si no está de acuerdo, le pedimos no
            utilizar nuestros canales digitales; puede acercarse directamente
            a nuestras oficinas.
          </p>
        </Section>

        <Section title="2. Descripción del servicio">
          <p>
            W Capital ofrece préstamos personales y a pequeñas empresas en
            Hermosillo, Sonora. A través de WhatsApp y Messenger operamos un
            asistente automatizado que responde preguntas frecuentes, orienta
            sobre requisitos y proceso, y permite iniciar una solicitud de
            crédito enviándole una liga segura para subir su documentación.
            En cualquier momento puede pedir hablar con una persona de
            nuestro equipo.
          </p>
        </Section>

        <Section title="3. Naturaleza informativa del asistente automatizado">
          <p>
            Ninguna respuesta generada por nuestro asistente automatizado
            constituye una oferta, aprobación, promesa de aprobación, ni
            compromiso de crédito. El monto, tasa y condiciones de cualquier
            préstamo se determinan únicamente después de un proceso formal de
            análisis y evaluación por parte de nuestro personal, conforme a
            nuestras políticas internas. El asistente automatizado no tiene
            autoridad para aprobar ni rechazar solicitudes.
          </p>
        </Section>

        <Section title="4. Responsabilidades del usuario">
          <p>Al interactuar con nosotros, usted se compromete a:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Proporcionar información veraz y actualizada.</li>
            <li>No suplantar la identidad de otra persona.</li>
            <li>No utilizar nuestros canales con fines fraudulentos o ilícitos.</li>
            <li>Ser mayor de edad y tener capacidad legal para contratar.</li>
          </ul>
        </Section>

        <Section title="5. Propiedad intelectual">
          <p>
            El nombre, logotipo y contenidos de W Capital son propiedad de W
            Capital S.A. de C.V. y no pueden reproducirse ni utilizarse sin
            autorización previa por escrito.
          </p>
        </Section>

        <Section title="6. Disponibilidad del servicio">
          <p>
            Procuramos que nuestros canales de atención estén disponibles de
            forma continua, pero no garantizamos disponibilidad
            ininterrumpida. Podemos suspender o modificar el servicio
            temporalmente por mantenimiento, causas técnicas, o ajenas a
            nuestro control.
          </p>
        </Section>

        <Section title="7. Limitación de responsabilidad">
          <p>
            W Capital no será responsable por retrasos o fallas derivadas de
            plataformas de terceros (como WhatsApp o Messenger, operadas por
            Meta Platforms, Inc.) que estén fuera de nuestro control. La
            evaluación final de cualquier solicitud de crédito se rige por
            nuestras políticas internas y la normatividad aplicable, no por
            lo conversado con el asistente automatizado.
          </p>
        </Section>

        <Section title="8. Cambios a estos términos">
          <p>
            Podemos actualizar estos Términos de Servicio en cualquier
            momento. Los cambios se publicarán en esta misma página,
            indicando la fecha de la última actualización.
          </p>
        </Section>

        <Section title="9. Ley aplicable y jurisdicción">
          <p>
            Estos términos se rigen por las leyes de los Estados Unidos
            Mexicanos. Para cualquier controversia, las partes se someten a
            los tribunales competentes de Hermosillo, Sonora, renunciando a
            cualquier otro fuero que pudiera corresponderles.
          </p>
        </Section>

        <Section title="10. Contacto">
          <p>
            W Capital S.A. de C.V.
            <br />
            Av. Luis Donaldo Colosio #158 Local 6, Plaza Universidad,
            Col. El Centenario, C.P. 83260, Hermosillo, Sonora, México
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
