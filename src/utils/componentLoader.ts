import type { ComponentType } from "react";

const cache = new Map<string, ComponentType<any>>();

export async function loadComponent(
  projectName: string,
  componentName: string,
): Promise<ComponentType<any>> {
  const key = `${projectName}/${componentName}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const url = `/components/${projectName}/${componentName}.tsx`;
  const mod = await import(/* @vite-ignore */ url);
  assert(mod.default, `Component "${componentName}" has no default export`);

  const component = mod.default as ComponentType<any>;
  cache.set(key, component);
  return component;
}

export function invalidateComponent(projectName: string, componentName: string): void {
  cache.delete(`${projectName}/${componentName}`);
}

function assert(condition: any, message: string): asserts condition {
  if (!condition) throw new Error(`[componentLoader] ${message}`);
}
