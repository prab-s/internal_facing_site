<script>
  import { Compartment, EditorState } from '@codemirror/state';
  import {
    Decoration,
    EditorView,
    keymap,
    lineNumbers,
    highlightActiveLineGutter,
    drawSelection,
    highlightSpecialChars,
    highlightActiveLine,
    MatchDecorator,
    ViewPlugin
  } from '@codemirror/view';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import {
    syntaxHighlighting,
    defaultHighlightStyle,
    bracketMatching,
    foldGutter,
    indentOnInput,
    indentUnit
  } from '@codemirror/language';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { html } from '@codemirror/lang-html';
  import { css } from '@codemirror/lang-css';
  import { onDestroy } from 'svelte';

  export let value = '';
  export let language = 'html';
  export let editable = true;
  export let label = '';
  export let onChange = () => {};

  let host;
  let editorView = null;
  let lastValue = value;
  const editableCompartment = new Compartment();
  const languageCompartment = new Compartment();
  const jinjaTokenMatcher = /(\{\{[\s\S]*?\}\}|\{%-?[\s\S]*?-?%\}|\{#.*?#\})/g;
  const jinjaDecorator = new MatchDecorator({
    regexp: jinjaTokenMatcher,
    decoration: (match) => {
      const token = match[0];
      let tokenClass = 'cm-jinja-token';
      if (token.startsWith('{{')) tokenClass += ' cm-jinja-expression';
      else if (token.startsWith('{#')) tokenClass += ' cm-jinja-comment';
      else tokenClass += ' cm-jinja-block';
      return Decoration.mark({ class: tokenClass });
    }
  });

  const jinjaHighlightPlugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = jinjaDecorator.createDeco(view);
      }

      update(update) {
        this.decorations = jinjaDecorator.updateDeco(update, this.decorations);
      }
    },
    {
      decorations: (instance) => instance.decorations
    }
  );

  function languageExtension(nextLanguage) {
    if (nextLanguage === 'css') return css();
    return html({
      autoCloseTags: true,
      matchClosingTags: true,
      selfClosingTags: true
    });
  }

  function createState(initialValue, nextLanguage, nextEditable) {
    return EditorState.create({
      doc: initialValue || '',
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        indentOnInput(),
        foldGutter(),
        highlightSpecialChars(),
        highlightActiveLine(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        oneDark,
        EditorState.tabSize.of(2),
        indentUnit.of('  '),
        editableCompartment.of(EditorView.editable.of(nextEditable)),
        languageCompartment.of(languageExtension(nextLanguage)),
        jinjaHighlightPlugin,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          lastValue = update.state.doc.toString();
          onChange(lastValue);
        }),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '0.92rem',
            backgroundColor: '#0f172a'
          },
          '.cm-scroller': {
            fontFamily:
              'ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, Liberation Mono, monospace'
          },
          '.cm-content': {
            padding: '0.9rem 0.75rem 1.25rem',
            caretColor: '#f8fafc',
            minHeight: '100%'
          },
          '.cm-gutters': {
            backgroundColor: '#0f172a',
            color: '#94a3b8',
            border: 'none'
          },
          '.cm-activeLine': {
            backgroundColor: 'rgba(59, 130, 246, 0.12)'
          },
          '.cm-activeLine, .cm-activeLineGutter': {
            backgroundColor: 'rgba(59, 130, 246, 0.14)'
          },
          '.cm-jinja-token': {
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            borderRadius: '0.25rem',
            padding: '0 0.08rem'
          },
          '.cm-jinja-expression': {
            color: '#fbbf24'
          },
          '.cm-jinja-block': {
            color: '#93c5fd'
          },
          '.cm-jinja-comment': {
            color: '#86efac',
            fontStyle: 'italic'
          }
        })
      ]
    });
  }

  function mountEditor() {
    if (!host || editorView) return;
    editorView = new EditorView({
      state: createState(value || '', language, editable),
      parent: host
    });
  }

  function syncExternalValue(nextValue) {
    const normalized = nextValue ?? '';
    if (!normalized) {
      lastValue = '';
      editorView?.destroy();
      editorView = null;
      return;
    }
    if (!editorView) {
      lastValue = normalized;
      mountEditor();
      return;
    }
    if (normalized === lastValue) return;
    lastValue = normalized;
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: normalized }
    });
  }

  function syncEditorOptions(nextLanguage, nextEditable) {
    if (!editorView) return;
    editorView.dispatch({
      effects: [
        editableCompartment.reconfigure(EditorView.editable.of(nextEditable)),
        languageCompartment.reconfigure(languageExtension(nextLanguage))
      ]
    });
  }

  $: mountEditor();
  $: syncExternalValue(value);
  $: syncEditorOptions(language, editable);

  onDestroy(() => {
    editorView?.destroy();
    editorView = null;
  });
</script>

<div class="source-editor-shell">
  {#if label}
    <div class="source-editor-label">{label}</div>
  {/if}
  <div class="source-editor-host">
    {#if !value}
      <div class="source-editor-placeholder">Load a template to edit {label || 'source'}.</div>
    {/if}
    <div bind:this={host} class="source-editor-canvas"></div>
  </div>
</div>

<style>
  .source-editor-shell {
    border: 1px solid rgba(15, 23, 42, 0.16);
    border-radius: 0.75rem;
    overflow: hidden;
    background: #0f172a;
    box-shadow: 0 0.35rem 1.25rem rgba(15, 23, 42, 0.08);
  }

  .source-editor-label {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #cbd5e1;
    background: linear-gradient(180deg, #111827 0%, #0f172a 100%);
    border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  }

  .source-editor-host {
    position: relative;
    min-height: 28rem;
    background: #0f172a;
  }

  .source-editor-canvas {
    min-height: 28rem;
  }

  .source-editor-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    color: #94a3b8;
    font-size: 0.92rem;
    font-style: italic;
    text-align: center;
    pointer-events: none;
  }

  :global(.cm-editor) {
    font-variant-ligatures: contextual;
  }
</style>
