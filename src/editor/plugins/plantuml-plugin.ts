import { $nodeSchema, $view, $remark } from '@milkdown/kit/utils';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import { createPlantUMLNodeView } from './plantuml-node-view';

// PlantUML server configuration
let plantUMLServer = 'https://www.plantuml.com/plantuml';

export function setPlantUMLServer(url: string): void {
  plantUMLServer = url.replace(/\/+$/, '');
}

export function getPlantUMLServer(): string {
  return plantUMLServer;
}

// -- Remark plugin: transform code[lang=plantuml] into plantumlBlock AST nodes --
// This ensures our schema matches before Crepe's code block handler

function visitNode(node: any, callback: (node: any, index: number, parent: any) => void, parent?: any, index?: number) {
  if (node.type === 'code') {
    callback(node, index ?? 0, parent);
  }
  if (node.children) {
    // Iterate in reverse to safely mutate during traversal
    for (let i = node.children.length - 1; i >= 0; i--) {
      visitNode(node.children[i], callback, node, i);
    }
  }
}

function remarkPlantuml() {
  return (tree: any) => {
    visitNode(tree, (node, index, parent) => {
      if (node.lang === 'plantuml' && parent?.children) {
        parent.children[index] = {
          type: 'plantumlBlock',
          value: node.value,
        };
      }
    });
  };
}

export const remarkPlantumlPlugin = $remark('remarkPlantuml', () => remarkPlantuml as any);

// -- PlantUML node schema --

export const plantumlId = 'plantuml';

export const plantumlSchema = $nodeSchema(plantumlId, () => ({
  group: 'block',
  atom: true,
  draggable: true,
  attrs: {
    value: { default: '' },
  },
  parseDOM: [
    {
      tag: `div[data-type="${plantumlId}"]`,
      getAttrs: (dom) => ({
        value: (dom as HTMLElement).dataset.value ?? '',
      }),
    },
  ],
  toDOM: (node) => {
    const div = document.createElement('div');
    div.dataset.type = plantumlId;
    div.dataset.value = node.attrs.value;
    div.textContent = node.attrs.value || '(plantuml)';
    return div;
  },
  parseMarkdown: {
    match: (node) => node.type === 'plantumlBlock',
    runner: (state, node, type) => {
      state.addNode(type, { value: node.value as string });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === plantumlId,
    runner: (state, node) => {
      state.addNode('code', undefined, node.attrs.value, {
        lang: 'plantuml',
      });
    },
  },
}));

// -- Node view --

export const plantumlView = $view(plantumlSchema.node, () =>
  createPlantUMLNodeView()
);

// -- Export all plugins --

export const plantumlPlugins: MilkdownPlugin[] = [
  ...remarkPlantumlPlugin,
  plantumlSchema.node,
  plantumlSchema.ctx,
  plantumlView,
];
