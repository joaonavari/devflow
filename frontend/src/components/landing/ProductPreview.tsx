import { LayoutDashboard, type LucideIcon } from 'lucide-react';

export function ProductPreview() {
  return (
    <figure className="landing-preview" aria-labelledby="product-preview-caption">
      <div className="landing-preview-bar" aria-hidden="true">
        <span className="landing-window-dots">
          <i />
          <i />
          <i />
        </span>
        <span>
          <LayoutDashboard size={14} /> DevFlow / Dashboard
        </span>
        <span className="landing-preview-label">Visão do produto</span>
      </div>
      <img
        className="landing-preview-image"
        src="/images/devflow-dashboard.webp"
        width={1600}
        height={1000}
        alt="Dashboard do DevFlow com projetos, tarefas, horas e resumo financeiro."
        decoding="async"
        fetchPriority="high"
      />
      <figcaption className="sr-only" id="product-preview-caption">
        Visão real do Dashboard do DevFlow preenchido com dados demonstrativos.
      </figcaption>
    </figure>
  );
}

interface ProductScreenshotProps {
  src: string;
  alt: string;
  context: string;
  label: string;
  icon: LucideIcon;
}

export function ProductScreenshot({
  src,
  alt,
  context,
  label,
  icon: Icon,
}: ProductScreenshotProps) {
  return (
    <figure className="landing-product-shot">
      <div className="landing-preview-bar" aria-hidden="true">
        <span className="landing-window-dots">
          <i />
          <i />
          <i />
        </span>
        <span>
          <Icon size={14} /> DevFlow / {context}
        </span>
        <span className="landing-preview-label">{label}</span>
      </div>
      <img src={src} width={1600} height={1000} alt={alt} loading="lazy" decoding="async" />
    </figure>
  );
}
