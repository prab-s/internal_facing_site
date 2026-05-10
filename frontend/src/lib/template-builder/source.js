const JINJA_PATTERN = /(\{\{[\s\S]*?\}\}|\{%-?[\s\S]*?-?%\}|\{#.*?#\})/g;

export function splitTemplateDocument(htmlContent) {
  if (typeof window === 'undefined') {
    return { headPrefix: '', bodyHtml: htmlContent, bodySuffix: '' };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const body = doc.body;
  let bodyInner = body ? body.innerHTML : htmlContent;
  bodyInner = bodyInner.replace(/<\/?body\b[^>]*>/gi, '').trim();
  const bodyMatch = htmlContent.match(/<body\b[^>]*>/i);
  const closingIndex = htmlContent.search(/<\/body>/i);

  if (!bodyMatch || closingIndex === -1) {
    return { headPrefix: '', bodyHtml: bodyInner, bodySuffix: '' };
  }

  const prefixEnd = bodyMatch.index + bodyMatch[0].length;
  return {
    headPrefix: htmlContent.slice(0, prefixEnd),
    bodyHtml: bodyInner,
    bodySuffix: htmlContent.slice(closingIndex)
  };
}

export function protectJinjaTokens(source, prefix = 'template-builder-token') {
  const tokens = [];
  const encoded = String(source || '').replace(JINJA_PATTERN, (token) => {
    const placeholder = `__${prefix}_${tokens.length}__`;
    tokens.push({ placeholder, token });
    return placeholder;
  });

  return { encoded, tokens };
}

export function restoreJinjaTokens(source, tokens = []) {
  return tokens.reduce((acc, entry) => acc.replaceAll(entry.placeholder, entry.token), String(source || ''));
}

export function safeJoinText(items, separator = ', ') {
  return (items || []).filter(Boolean).join(separator);
}

export function stripTemplateStylesheetLinks(htmlContent) {
  if (!htmlContent) return '';
  return String(htmlContent).replace(
    /<link\b[^>]*rel=(["'])stylesheet\1[^>]*href=(["'])\.\/template\.css\2[^>]*\/?>/gi,
    ''
  );
}

export function stripHtmlTags(value) {
  if (value == null || value === '') return '';
  const template = document.createElement('template');
  template.innerHTML = String(value);
  return template.content.textContent || '';
}

function createPreviewWrapper(token, sampleHtml) {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-jinja-token', token);
  wrapper.style.display = 'contents';
  const sample = String(sampleHtml ?? '');
  if (sample) {
    wrapper.innerHTML = sample;
  } else {
    wrapper.textContent = 'No data available';
  }
  return wrapper;
}

function replaceTokensInString(source, tokenResolver, context = 'text') {
  return String(source || '').replace(JINJA_PATTERN, (token) => {
    const sample = tokenResolver ? tokenResolver(token, context) : '';
    if (sample == null || sample === '') {
      return context === 'attr' ? '' : 'No data available';
    }
    return context === 'attr' ? stripHtmlTags(sample) : String(sample);
  });
}

function isJinjaAttributeValue(value) {
  return typeof value === 'string' && cloneTokenPattern().test(value);
}

function cloneTokenPattern() {
  return new RegExp(JINJA_PATTERN.source, 'g');
}

function renderPreviewTextNode(doc, textNode, tokenResolver) {
  const text = textNode.textContent || '';
  if (!cloneTokenPattern().test(text)) return;

  const fragment = document.createDocumentFragment();
  const pattern = cloneTokenPattern();
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text))) {
    const token = match[0];
    if (match.index > lastIndex) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
    }

    const sample = tokenResolver ? tokenResolver(token, 'text') : '';
    const wrapper = createPreviewWrapper(token, sample);
    fragment.appendChild(wrapper);
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
  }

  textNode.replaceWith(fragment);
}

function renderPreviewElementAttributes(element, tokenResolver) {
  for (const attr of Array.from(element.attributes || [])) {
    if (!isJinjaAttributeValue(attr.value)) continue;
    const existing = element.getAttribute('data-jinja-attrs');
    const storedAttrs = existing ? JSON.parse(existing) : {};
    storedAttrs[attr.name] = attr.value;
    element.setAttribute('data-jinja-attrs', JSON.stringify(storedAttrs));
    element.setAttribute(attr.name, replaceTokensInString(attr.value, tokenResolver, 'attr'));
  }
}

export function renderPreviewHtmlSource(htmlContent, tokenResolver = null) {
  if (!htmlContent) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(String(htmlContent), 'text/html');
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
  const nodes = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parentTag = node.parentElement?.tagName?.toLowerCase() || '';
      if (['script', 'style'].includes(parentTag)) continue;
      renderPreviewTextNode(doc, node, tokenResolver);
      continue;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      renderPreviewElementAttributes(node, tokenResolver);
    }
  }

  return doc.body.innerHTML;
}

export function restorePreviewHtmlSource(htmlContent) {
  if (!htmlContent) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(String(htmlContent), 'text/html');

  for (const element of Array.from(doc.querySelectorAll('[data-jinja-token]')).reverse()) {
    const token = element.getAttribute('data-jinja-token') || '';
    element.replaceWith(doc.createTextNode(token));
  }

  for (const element of Array.from(doc.querySelectorAll('*'))) {
    const storedAttrs = element.getAttribute('data-jinja-attrs');
    if (!storedAttrs) continue;

    try {
      const parsedAttrs = JSON.parse(storedAttrs);
      for (const [name, value] of Object.entries(parsedAttrs)) {
        element.setAttribute(name, value);
      }
    } catch {
      // Ignore malformed stored attribute data and keep the preview value.
    }

    element.removeAttribute('data-jinja-attrs');
  }

  return doc.body.innerHTML;
}

function indentString(depth, indent = '  ') {
  return indent.repeat(Math.max(0, depth));
}

function formatAttributeValue(value) {
  if (value == null) return '';
  return String(value).replace(/"/g, '&quot;');
}

function formatHtmlNode(node, depth, indent) {
  const pieces = [];
  const pad = indentString(depth, indent);

  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) pieces.push(`${pad}${text}`);
    return pieces;
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    pieces.push(`${pad}<!--${node.textContent || ''}-->`);
    return pieces;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return pieces;

  const tagName = node.tagName.toLowerCase();
  const attrs = [...node.attributes].map((attr) => ` ${attr.name}="${formatAttributeValue(attr.value)}"`).join('');
  const selfClosing = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'].includes(tagName);
  const childNodes = [...node.childNodes];
  const meaningfulChildren = childNodes.some((child) => {
    if (child.nodeType === Node.TEXT_NODE) return (child.textContent || '').trim() !== '';
    return true;
  });

  if (selfClosing) {
    pieces.push(`${pad}<${tagName}${attrs} />`);
    return pieces;
  }

  if (!meaningfulChildren) {
    pieces.push(`${pad}<${tagName}${attrs}></${tagName}>`);
    return pieces;
  }

  const inlineTextOnly = childNodes.length === 1 && childNodes[0].nodeType === Node.TEXT_NODE;
  if (inlineTextOnly) {
    const text = (childNodes[0].textContent || '').replace(/\s+/g, ' ').trim();
    pieces.push(`${pad}<${tagName}${attrs}>${text}</${tagName}>`);
    return pieces;
  }

  pieces.push(`${pad}<${tagName}${attrs}>`);
  for (const child of childNodes) {
    pieces.push(...formatHtmlNode(child, depth + 1, indent));
  }
  pieces.push(`${pad}</${tagName}>`);
  return pieces;
}

export function formatHtmlSource(htmlContent, indent = '  ') {
  if (!htmlContent) return '';
  const { encoded, tokens } = protectJinjaTokens(htmlContent, 'format-html');
  const parser = new DOMParser();
  const doc = parser.parseFromString(encoded, 'text/html');
  const parts = [];
  const sourceLooksLikeDocument = /<!doctype|<html\b|<head\b|<body\b/i.test(String(htmlContent));

  if (sourceLooksLikeDocument && doc.documentElement) {
    if (doc.doctype) {
      parts.push(`<!DOCTYPE ${doc.doctype.name || 'html'}>`);
    }
    parts.push(...formatHtmlNode(doc.documentElement, 0, indent));
  } else {
    for (const child of doc.body.childNodes) {
      parts.push(...formatHtmlNode(child, 0, indent));
    }
  }

  return restoreJinjaTokens(parts.join('\n'), tokens);
}

export function formatCssSource(cssContent) {
  const source = String(cssContent || '').trim();
  if (!source) return '';

  const protectedSource = protectJinjaTokens(source, 'format-css');
  const indent = '  ';

  function formatDeclarations(style, depth) {
    const lines = [];
    for (let index = 0; index < style.length; index += 1) {
      const propertyName = style.item(index);
      if (!propertyName) continue;
      const propertyValue = style.getPropertyValue(propertyName).trim();
      const priority = style.getPropertyPriority(propertyName);
      lines.push(
        `${indent.repeat(depth + 1)}${propertyName}: ${propertyValue}${priority ? ' !important' : ''};`
      );
    }
    return lines;
  }

  function formatRule(rule, depth = 0) {
    const pad = indent.repeat(depth);

    if (typeof CSSRule !== 'undefined') {
      if (rule.type === CSSRule.STYLE_RULE) {
        const lines = [`${pad}${rule.selectorText} {`];
        lines.push(...formatDeclarations(rule.style, depth));
        lines.push(`${pad}}`);
        return lines;
      }

      if (rule.type === CSSRule.MEDIA_RULE) {
        return [`${pad}@media ${rule.conditionText} {`, ...formatNestedRules(rule.cssRules, depth + 1), `${pad}}`];
      }

      if (rule.type === CSSRule.SUPPORTS_RULE) {
        return [`${pad}@supports ${rule.conditionText} {`, ...formatNestedRules(rule.cssRules, depth + 1), `${pad}}`];
      }

      if (rule.type === CSSRule.LAYER_BLOCK_RULE || rule.type === CSSRule.LAYER_RULE) {
        const layerName = rule.name ? ` ${rule.name}` : '';
        if (rule.cssRules) {
          return [`${pad}@layer${layerName} {`, ...formatNestedRules(rule.cssRules, depth + 1), `${pad}}`];
        }
        return [`${pad}${rule.cssText.trim()}`];
      }

      if (rule.type === CSSRule.FONT_FACE_RULE) {
        const lines = [`${pad}@font-face {`];
        lines.push(...formatDeclarations(rule.style, depth));
        lines.push(`${pad}}`);
        return lines;
      }

      if (rule.type === CSSRule.KEYFRAMES_RULE) {
        return [`${pad}@keyframes ${rule.name} {`, ...formatNestedRules(rule.cssRules, depth + 1), `${pad}}`];
      }

      if (rule.type === CSSRule.KEYFRAME_RULE) {
        const lines = [`${pad}${rule.keyText} {`];
        lines.push(...formatDeclarations(rule.style, depth));
        lines.push(`${pad}}`);
        return lines;
      }

      if (rule.type === CSSRule.PAGE_RULE) {
        const selector = rule.selectorText ? ` ${rule.selectorText}` : '';
        const lines = [`${pad}@page${selector} {`];
        lines.push(...formatDeclarations(rule.style, depth));
        lines.push(`${pad}}`);
        return lines;
      }

      if (rule.type === CSSRule.IMPORT_RULE || rule.type === CSSRule.NAMESPACE_RULE) {
        return [`${pad}${rule.cssText.trim()}`];
      }

      if (rule.cssRules) {
        return [`${pad}${rule.cssText.trim()}`];
      }
    }

    return [`${pad}${rule.cssText.trim()}`];
  }

  function formatNestedRules(rules, depth) {
    const lines = [];
    for (const nestedRule of Array.from(rules || [])) {
      lines.push(...formatRule(nestedRule, depth), '');
    }
    if (lines.length > 0) lines.pop();
    return lines;
  }

  try {
    if (typeof CSSStyleSheet !== 'undefined') {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(protectedSource.encoded);
      const lines = [];
      for (const rule of Array.from(sheet.cssRules || [])) {
        lines.push(...formatRule(rule, 0), '');
      }
      if (lines.length > 0) lines.pop();
      return restoreJinjaTokens(lines.join('\n').trim(), protectedSource.tokens);
    }
  } catch {
    // Fall back to the manual formatter below when the CSS parser rejects the source.
  }

  let result = '';
  let depth = 0;
  let inString = null;
  let inComment = false;

  const appendIndent = () => {
    result += indent.repeat(Math.max(0, depth));
  };

  const trimLineEnd = () => {
    result = result.replace(/[ \t]+$/g, '');
  };

  for (let index = 0; index < protectedSource.encoded.length; index += 1) {
    const char = protectedSource.encoded[index];
    const nextChar = protectedSource.encoded[index + 1];

    if (inComment) {
      result += char;
      if (char === '*' && nextChar === '/') {
        result += nextChar;
        index += 1;
        inComment = false;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (char === '\\' && nextChar) {
        result += nextChar;
        index += 1;
        continue;
      }
      if (char === inString) inString = null;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      trimLineEnd();
      if (result && !result.endsWith('\n')) result += '\n';
      appendIndent();
      result += '/*';
      inComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      result += char;
      inString = char;
      continue;
    }

    if (char === '{') {
      trimLineEnd();
      result += ' {\n';
      depth += 1;
      appendIndent();
      continue;
    }

    if (char === '}') {
      trimLineEnd();
      result = result.replace(/\n[ \t]*$/g, '\n');
      if (!result.endsWith('\n')) result += '\n';
      depth = Math.max(0, depth - 1);
      appendIndent();
      result += '}\n\n';
      appendIndent();
      continue;
    }

    if (char === ';') {
      result += ';\n';
      appendIndent();
      continue;
    }

    if (char === '\n' || char === '\r' || char === '\t') {
      if (!result.endsWith(' ') && !result.endsWith('\n')) {
        result += ' ';
      }
      continue;
    }

    if (char === ' ' && (!result || result.endsWith('\n') || result.endsWith(' '))) {
      continue;
    }

    result += char;
  }

  return restoreJinjaTokens(
    result
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    protectedSource.tokens
  );
}
