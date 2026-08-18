export const metadata = {
  title: "Aviso de Privacidad · W Capital",
  description:
    "Aviso de privacidad de W Capital S.A. de C.V. sobre el tratamiento de datos personales.",
};

// Forzado a dinámico para que reciba el nonce de CSP por request (ver src/proxy.ts)
export const dynamic = "force-dynamic";

const LAST_UPDATED = "16 de agosto de 2026";

export default function PrivacidadPage() {
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
              Aviso de privacidad
            </p>
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-2xl px-4 py-10 text-[14.5px] leading-[1.7] text-ink">
        <h1 className="font-serif text-[32px] font-normal leading-[1.15] tracking-[-.01em] text-ink">
          Aviso de Privacidad
        </h1>
        <p className="mt-2 text-[12.5px] text-ink-3">
          Última actualización: {LAST_UPDATED}
        </p>

        <Section title="1. Responsable del tratamiento de sus datos personales">
          <p>
            <strong>W Capital S.A. de C.V.</strong> (&ldquo;W Capital&rdquo;, &ldquo;nosotros&rdquo;),
            con domicilio en Av. Luis Donaldo Colosio #158 Local 6, entre
            Marsella y Campodónico, Plaza Universidad, Col. El Centenario,
            C.P. 83260, Hermosillo, Sonora, México, es responsable del uso y
            protección de sus datos personales conforme a la Ley Federal de
            Protección de Datos Personales en Posesión de los Particulares
            (LFPDPPP) y su Reglamento.
          </p>
        </Section>

        <Section title="2. Datos personales que recabamos">
          <p>Dependiendo de cómo interactúe con nosotros, podemos recabar:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Datos de identificación y contacto:</strong> nombre
              completo, número de teléfono, y en su caso correo electrónico.
            </li>
            <li>
              <strong>Datos de la conversación:</strong> los mensajes que
              usted nos envía por WhatsApp o Messenger, y el identificador de
              esa cuenta (número de WhatsApp o ID de Messenger), para poder
              responderle y darle seguimiento.
            </li>
            <li>
              <strong>Datos para su solicitud de crédito:</strong>{" "}
              identificación oficial vigente (INE o pasaporte), comprobante de
              domicilio, comprobante de ingresos o estados de cuenta
              bancarios, e información sobre la garantía ofrecida (propiedad
              o factura de vehículo).
            </li>
            <li>
              <strong>Datos patrimoniales y crediticios:</strong> con su
              autorización expresa, consultamos su historial crediticio ante
              sociedades de información crediticia (buró de crédito) como
              parte de la evaluación de su solicitud.
            </li>
            <li>
              <strong>Datos de su negocio</strong>, si la solicitud es para
              una empresa (nombre y giro del negocio).
            </li>
          </ul>
        </Section>

        <Section title="3. Finalidades del tratamiento">
          <p>Sus datos personales se utilizan para:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Atenderle y responder sus preguntas por WhatsApp o Messenger, incluyendo a través de un asistente automatizado.</li>
            <li>Evaluar, procesar y dar seguimiento a su solicitud de crédito.</li>
            <li>Consultar su historial crediticio ante sociedades de información crediticia, cuando usted lo autoriza.</li>
            <li>Administrar y dar cobranza a los préstamos otorgados.</li>
            <li>Cumplir con obligaciones legales y regulatorias aplicables a instituciones de crédito.</li>
            <li>Contactarlo para informarle sobre el estatus de su solicitud o préstamo.</li>
          </ul>
          <p className="mt-2">
            No utilizamos sus datos personales para fines mercadotécnicos,
            publicitarios o de prospección comercial distintos a los
            señalados, salvo que usted nos autorice expresamente a hacerlo.
          </p>
        </Section>

        <Section title="4. Uso de WhatsApp y Messenger (Meta)">
          <p>
            Nuestra atención por WhatsApp Business y Messenger opera sobre la
            plataforma de Meta Platforms, Inc. Los mensajes que usted nos
            envía por estos medios se transmiten a través de la
            infraestructura de Meta conforme a sus propias condiciones y
            políticas de privacidad, y son recibidos por nuestros sistemas
            para darle seguimiento. No compartimos con Meta más información
            de la estrictamente necesaria para operar el servicio de
            mensajería (por ejemplo, el contenido de la respuesta que le
            enviamos).
          </p>
        </Section>

        <Section title="5. Transferencia de datos a terceros">
          <p>Sus datos pueden ser compartidos, únicamente para los fines antes descritos, con:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Sociedades de información crediticia (buró de crédito), con su autorización previa.</li>
            <li>Proveedores de infraestructura tecnológica que almacenan y procesan la información en nuestro nombre, bajo obligaciones de confidencialidad.</li>
            <li>Autoridades competentes, cuando exista un requerimiento legal.</li>
          </ul>
          <p className="mt-2">No vendemos ni rentamos sus datos personales a terceros.</p>
        </Section>

        <Section title="6. Derechos ARCO">
          <p>
            Usted tiene derecho a Acceder, Rectificar y Cancelar sus datos
            personales, así como a Oponerse al tratamiento de los mismos o a
            revocar el consentimiento que nos haya otorgado (derechos ARCO).
            Para ejercerlos, puede comunicarse al teléfono{" "}
            <a href="tel:+526622125007" className="font-medium text-brand hover:underline">
              662 212 5007
            </a>
            , indicando su nombre, la solicitud concreta y un medio de
            contacto. Le responderemos en un plazo máximo de 20 días hábiles,
            conforme a lo establecido por la LFPDPPP.
          </p>
        </Section>

        <Section title="7. Medidas de seguridad">
          <p>
            Sus datos se almacenan en infraestructura con controles de acceso
            restringido y transmisión cifrada, y solo el personal autorizado
            de W Capital tiene acceso a ellos para los fines aquí descritos.
          </p>
        </Section>

        <Section title="8. Cambios a este aviso">
          <p>
            Podemos actualizar este aviso de privacidad ante cambios en
            nuestras prácticas o por requerimientos legales. Publicaremos
            cualquier cambio en esta misma página, indicando la fecha de la
            última actualización.
          </p>
        </Section>

        <Section title="9. Contacto">
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
