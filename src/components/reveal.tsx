"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";

type RevealProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "className"> & {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  delay?: number;
};

/** Reveals content once when it enters the viewport, then leaves it visible. */
export function Reveal({ as: Component = "div", children, className = "", delay, ...props }: RevealProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <Component {...props} ref={elementRef} className={`reveal ${visible ? "is-visible" : ""} ${className}`} style={delay ? { "--reveal-delay": `${delay}ms` } : undefined}>{children}</Component>;
}
