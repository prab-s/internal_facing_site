<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import RichTextEditor from '$lib/editor/RichTextEditor.svelte';
  import BackgroundControls from '$lib/editor/BackgroundControls.svelte';
  import ActionEditor from '$lib/editor/ActionEditor.svelte';
  import { getCmsPages, createCmsPage, deleteCmsPage, getCmsNavigation, updateCmsPage, publishCmsPage, updateCmsNavigation } from '$lib/api.js';

  let pageNames = ['About Us', 'Contact', 'Engineering Services', 'Past Projects', 'Enquiries modal'];
  const sectionTypes = [
    { value: 'rich-text', label: 'Rich text' },
    { value: 'cards', label: 'Cards / grid' },
    { value: 'image-text', label: 'Image and text' },
    { value: 'carousel', label: 'Carousel' },
    { value: 'cta', label: 'Enquiry CTA' }
  ];
  const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const rich = (title, text) => ({ id: makeId(), type: 'rich-text', title, width: 'full', columns: 1, content: `<h2>${title}</h2><p>${text}</p>` });
  const enquiryAction = (defaultType = '') => ({ type: 'modal', target: 'quoteRequestModal', ...(defaultType ? { defaultType } : {}) });
  const cards = (title, items, width = 'full', columns = 3) => ({ id: makeId(), type: 'cards', title, width, columns, content: '', cards: items.map(([cardTitle, text, image = '']) => ({ id: makeId(), title: cardTitle, content: `<p>${text}</p>`, image })) });
  const carousel = (title) => ({ id: makeId(), type: 'carousel', title, width: 'full', columns: 1, content: '', autoplay: true, cards: [{ id: makeId(), title: 'First slide', content: '<p>Add slide content here.</p>', image: '' }, { id: makeId(), title: 'Second slide', content: '<p>Add another slide here.</p>', image: '' }] });
  const cta = (title, text) => ({ id: makeId(), type: 'cta', title, width: 'full', columns: 1, content: `<h2>${title}</h2><p>${text}</p>`, actionLabel: 'Make an enquiry', action: enquiryAction() });
  function normaliseSections(value) {
    const migrated = [];
    let migratedLabel = '';
    for (const source of clone(value || [])) {
      const section = { ...source };
      if (Array.isArray(section.cards)) {
        section.cards = section.cards.map((card) => {
          const legacyLabel = card.ctaLabel && card.ctaLabel !== card.title ? card.ctaLabel : '';
          if (legacyLabel || card.action) migratedLabel ||= legacyLabel || 'Make an enquiry';
          const { action, ctaLabel, ...contentCard } = card;
          return contentCard;
        });
      }
      if (section.type === 'cta') {
        section.actionLabel = section.actionLabel || 'Make an enquiry';
        section.action = section.action || enquiryAction();
      }
      migrated.push(section);
    }
    if (migratedLabel && !migrated.some((section) => section.type === 'cta')) {
      migrated.push(cta('Need help choosing the right route?', 'Tell us what you need and we’ll help with the next step.'));
      migrated[migrated.length - 1].actionLabel = migratedLabel;
    }
    return migrated;
  }
  function pageSlugForName(name) { return cmsPages.find((page) => page.label === name)?.slug || ({ 'About Us': 'about-us', Contact: 'contact', 'Engineering Services': 'engineering-services', 'Past Projects': 'past-projects', 'Enquiries modal': 'enquiries-modal' }[name] || ''); }
  function selectPageFromLocation(response) { const requestedSlug = browser ? new URLSearchParams(window.location.search).get('page') : ''; const requested = response.find((page) => page.slug === requestedSlug); const knownNames = { 'about-us': 'About Us', contact: 'Contact', 'engineering-services': 'Engineering Services', 'past-projects': 'Past Projects', 'enquiries-modal': 'Enquiries modal' }; return requested ? (knownNames[requested.slug] || requested.label) : pageNames[0]; }
  function syncPageUrl(name) { if (!browser) return; const slug = pageSlugForName(name); if (slug) goto(`/cms?page=${encodeURIComponent(slug)}`, { replaceState: true, keepFocus: true, noScroll: true }); }

  function pageSections(page) {
    if (page === 'About Us') return [
      rich('Engineering better air movement', 'Practical products, thoughtful engineering, and people who care about the details.'),
      rich('Our story', 'Vent-Tech was established to help customers find dependable air-management and ventilation products without unnecessary complexity.'),
      cards('What matters to us', [['Be useful', 'Make product information clear and keep the next step easy to understand.'], ['Build with care', 'Pay attention to materials, measurements, finishes, and the small details.'], ['Keep improving', 'Learn from every project and keep refining the customer experience.']]),
      cards('The people behind the work', [['Team member one', 'Placeholder role and biography.'], ['Team member two', 'Placeholder role and biography.'], ['Team member three', 'Placeholder role and biography.']], 'half', 3),
      cards('How we help', [['Listen', 'Understand the application, constraints, and desired outcome.'], ['Recommend', 'Point customers toward suitable products or services.'], ['Support', 'Provide documentation, technical context, and practical guidance.'], ['Follow through', 'Keep communication clear from enquiry through delivery.']], 'half', 2),
      cta('Have a question about a product, project, or custom requirement?', 'Invite the customer to open the Enquiries modal.')
    ];
    if (page === 'Contact') return [
      rich('Talk to Vent-Tech about selection, pricing, or project support', 'Use the team below for direct help with product selection, quoting, and documentation.'),
      cards('Request a quote and visit us', [['Request a quote', 'Send the project details through and the team can point you to the right next step.'], ['Vent-Tech 2018 Ltd.', '576c Fergusson Drive, Upper Hutt 5018, Wellington.', '/static/media/venttech_shop_front.jpg']], 'half', 2),
      cards('Direct contacts', [['Admin', 'Shop — general · admin@venttech.co.nz · 04 595 1403'], ['Gerald Keown', 'Managing Director · gerald@venttech.co.nz'], ['Nilesh Patel', 'Design / Technical / Sales · nilesh@venttech.co.nz'], ['Alex Keown', 'Operations Manager · alex@venttech.co.nz'], ['Mahendra Dahya', 'Technical / Sales · mahendra@venttech.co.nz']], 'full', 3),
      cta('Need help choosing the right route?', 'Open the Enquiries modal and tell us what you need.')
    ];
    if (page === 'Engineering Services') return [
      rich('Fabrication support for custom metalwork and project build-outs', 'Our engineering services cover the practical workshop processes that turn flat material into usable parts.'),
      cards('Workshop capabilities', [['Workshop capabilities', 'Laser cutting<br>Brake pressing<br>Rolling<br>Flanging']], 'half', 1),
      rich('Reliable workshop processes that support fabrication and product development', 'Engineering services are often the bridge between design intent and a finished component. We can help with one-off parts and custom fabrication requirements.'),
      cards('Our service areas', [['Laser cutting', 'Repeatable cut profiles and efficient sheet utilisation.', '/static/media/laser-cutter.svg'], ['Brake pressing', 'Accurate bends and formed panels.', '/static/media/brake-press.svg'], ['Rolling', 'Controlled curved sections and repeatable radii.', '/static/media/roller.svg'], ['Flanging', 'Stiffened component edges and neat assembly details.', '/static/media/flanger.svg']], 'full', 4),
      cta('Need something made for a specific space, duty, or application?', 'Share your dimensions, drawings, photos, or performance requirements with the team.')
    ];
    if (page === 'Past Projects') return [
      rich('A quick look at previous project highlights', 'Finished jobs, case studies, before-and-after examples, and the outcomes customers can expect.'),
      cards('Project collage', [['Laser cutting', 'Precision sheet work and repeatable cut profiles.', '/static/media/laser-cutter.svg'], ['Brake pressing', 'Clean folds, returns, and formed sections.', '/static/media/brake-press.svg'], ['Rolling', 'Curved sections and controlled radii.', '/static/media/roller.svg'], ['Flanging', 'Stiffened edges and tidy assembly details.', '/static/media/flanger.svg']], 'full', 4),
      cards('Project context', [['Short, visual summaries', 'The problem to solve and the finished result.'], ['Examples by sector', 'Ventilation, fabrication support, commercial builds, and custom engineering.'], ['A few useful details', 'Project goals, fabrication steps, and notable outcomes.']], 'full', 3),
      cta('Want to discuss a similar project?', 'Open the Enquiries modal and tell us about the job.')
    ];
    if (page !== 'Enquiries modal') return [rich(page, 'Add the approved content for this new page.'), cta('Ready to talk?', 'Invite customers to open the Enquiries modal.')];
    return [
      rich('Tell us what you need', 'Choose the option that best describes what you need and we’ll route your enquiry to the right person.'),
      cards('How should we quote this?', [['Quote this item', 'Use the current product or series as the starting point.'], ['Tailored product', 'I need something that does not exist in the current catalogue.'], ['Help me choose', 'Answer a few quick questions and we’ll point you in the right direction.']], 'full', 3),
      rich('Your enquiry will be sent directly to the Vent-Tech team.', 'The form collects your contact details and any project context you can share.')
    ];
  }

  let activePage = pageNames[0];
  let pageDrafts = Object.fromEntries(pageNames.map((name) => [name, pageSections(name)]));
  let sections = pageDrafts[activePage];
  let undoStack = [];
  let draggedSection = null;
  let sectionDropTarget = null;
  let draggedCard = null;
  let selectedSectionId = sections[0].id;
  let cmsPages = [];
  let cmsPageData = {};
  let pageContentDrafts = {};
  let navigation = [];
  let eventLog = [];
  let notification = '';
  let notificationType = 'success';
  let savingPage = false;
  let creating = false;
  let createOpen = false;
  let newLabel = '';
  let newSlug = '';
  let slugEdited = false;
  let newTemplate = 'standard';
  let creationMode = 'template';
  let copySource = '';
  let previewMode = false;
  $: protectedPage = activePage === 'Enquiries modal';
  $: activePageSlug = slugForPage(activePage);
  $: activeContent = pageContentDrafts[activePageSlug] || cmsPageData[activePageSlug]?.draft_content || {};

  onMount(async () => {
    try {
      const response = await getCmsPages();
      cmsPageData = Object.fromEntries(response.map((page) => [page.slug, page]));
      pageContentDrafts = Object.fromEntries(response.map((page) => [page.slug, clone(page.draft_content || {})]));
      cmsPages = response.map((page) => ({ slug: page.slug, label: page.label, status: page.status }));
      const pageNameBySlug = { 'about-us': 'About Us', contact: 'Contact', 'engineering-services': 'Engineering Services', 'past-projects': 'Past Projects', 'enquiries-modal': 'Enquiries modal' };
      for (const page of response) if (!pageNameBySlug[page.slug]) pageNameBySlug[page.slug] = page.label;
      pageNames = response.map((page) => pageNameBySlug[page.slug]);
      activePage = selectPageFromLocation(response);
      pageDrafts = Object.fromEntries(response.map((page) => [pageNameBySlug[page.slug], page.draft_layout?.length ? normaliseSections(page.draft_layout) : pageDrafts[pageNameBySlug[page.slug]] || pageSections(pageNameBySlug[page.slug])]).filter(([name]) => name));
      sections = pageDrafts[activePage] || sections;
      syncPageUrl(activePage);
      navigation = await getCmsNavigation();
      recordEvent('Loaded CMS page statuses and navigation order.');
    } catch (error) {
      recordEvent(`CMS status/navigation unavailable: ${error?.message || 'request failed'}`);
    }
  });

  function recordEvent(message) { eventLog = [...eventLog.slice(-49), { time: new Date().toLocaleTimeString(), message }]; }
  function notify(message, type = 'success') { notification = message; notificationType = type; window.setTimeout(() => { notification = ''; }, 3200); }
  function paintStyle(item) { const color = item?.backgroundColor; if (!color) return ''; const opacity = Math.max(0, Math.min(1, Number(item.backgroundOpacity ?? 1))); const first = `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)`; if (item.gradientEnabled && item.gradientColor) { const second = `color-mix(in srgb, ${item.gradientColor} ${opacity * 100}%, transparent)`; return `background:linear-gradient(${Number(item.gradientAngle || 90)}deg, ${first}, ${second});`; } return `background:${first};`; }

  function snapshot() { undoStack = [...undoStack.slice(-39), clone(sections)]; }
  function applySections(next) { sections = next; pageDrafts = { ...pageDrafts, [activePage]: next }; selectedSectionId = next[0]?.id || null; }
  function selectPage(event) { activePage = event.currentTarget.value; sections = pageDrafts[activePage]; undoStack = []; selectedSectionId = sections[0]?.id || null; syncPageUrl(activePage); }
  function selectSection(sectionId) { selectedSectionId = sectionId; }
  function selectSectionFromKeyboard(sectionId, event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectSection(sectionId); } }
  function addSection(type = 'rich-text') { snapshot(); const section = type === 'cards' ? cards('New section', [['New card', 'Add card content here.']], 'auto', 3) : type === 'carousel' ? carousel('New carousel') : type === 'cta' ? cta('Need help choosing the right route?', 'Tell us what you need and we’ll help with the next step.') : { id: makeId(), type, title: 'New section', width: 'auto', columns: 1, content: '<h2>New section</h2><p>Add your content here.</p>' }; applySections([...sections, section]); recordEvent(`Added ${sectionLabel(type)} section to ${activePage}.`); }
  function removeSection(index) { snapshot(); recordEvent(`Removed “${sections[index]?.title || 'section'}” from ${activePage}.`); applySections(sections.filter((_, itemIndex) => itemIndex !== index)); }
  function updateSection(index, field, value) { const next = clone(sections); next[index][field] = value; applySections(next); }
  function updateCard(sectionIndex, cardIndex, field, value) { const next = clone(sections); next[sectionIndex].cards[cardIndex][field] = value; applySections(next); }
  function addCard(sectionIndex) { snapshot(); const next = clone(sections); next[sectionIndex].cards = [...(next[sectionIndex].cards || []), { id: makeId(), title: 'New card', content: '<p>Add card content here.</p>', image: '' }]; applySections(next); recordEvent(`Added a card to “${next[sectionIndex].title}”.`); }
  function removeCard(sectionIndex, cardIndex) { snapshot(); const next = clone(sections); next[sectionIndex].cards = next[sectionIndex].cards.filter((_, index) => index !== cardIndex); applySections(next); recordEvent(`Removed card ${cardIndex + 1} from “${next[sectionIndex].title}”.`); }
  function undo() { const previous = undoStack.at(-1); if (!previous) return; undoStack = undoStack.slice(0, -1); applySections(previous); recordEvent('Undid the last builder change.'); }
  function moveSection(from, to) { if (from === to || from === to - 1) return; snapshot(); const next = [...sections]; const [item] = next.splice(from, 1); const destination = from < to ? to - 1 : to; next.splice(destination, 0, item); applySections(next); recordEvent(`Moved section to position ${destination + 1}.`); }
  function moveCard(sectionIndex, from, to) { if (from === to) return; snapshot(); const next = clone(sections); const cards = next[sectionIndex].cards; const [item] = cards.splice(from, 1); cards.splice(to, 0, item); applySections(next); }
  function sectionDragOver(index, event) { event.preventDefault(); if (draggedSection === null || draggedSection === index) { sectionDropTarget = null; return; } const midpoint = event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2; sectionDropTarget = { index, position: event.clientY < midpoint ? 'before' : 'after' }; }
  function sectionDrop(index, event) { event.preventDefault(); if (draggedSection !== null && sectionDropTarget?.index === index) moveSection(draggedSection, sectionDropTarget.position === 'before' ? index : index + 1); draggedSection = null; sectionDropTarget = null; }
  function clearSectionDrag() { draggedSection = null; sectionDropTarget = null; }
  function cardDrop(sectionIndex, index, event) { event.preventDefault(); if (draggedCard?.sectionIndex === sectionIndex) moveCard(sectionIndex, draggedCard.cardIndex, index); draggedCard = null; }
  function sectionLabel(type) { return sectionTypes.find((item) => item.value === type)?.label || 'Section'; }
  function updateSectionAction(index, event) { updateSection(index, 'action', event.detail); }
  function updateContentField(field, value) { pageContentDrafts = { ...pageContentDrafts, [activePageSlug]: { ...activeContent, [field]: value } }; }
  function updateContextField(field, value) { updateContentField('context_fields', { ...(activeContent.context_fields || {}), [field]: value }); }
  async function saveNavigation() { try { const response = await updateCmsNavigation(navigation); navigation = response.items || navigation; recordEvent('Saved CMS navigation order and actions.'); notify('CMS navigation saved.'); } catch (error) { recordEvent(`Navigation save failed: ${error?.message || 'request failed'}`); notify(error?.message || 'Unable to save navigation order.', 'error'); } }
  function addEnquiriesNavigationItem() { if (navigation.some((item) => item.id === 'custom-enquiries')) return; navigation = [...navigation, { id: 'custom-enquiries', slug: '', label: 'Enquiries', status: 'custom', href: '', action: { type: 'modal', target: 'quoteRequestModal' } }]; recordEvent('Added the Enquiries modal to navigation.'); }
  const slugForPage = (name) => cmsPages.find((page) => page.label === name)?.slug || ({ 'About Us': 'about-us', Contact: 'contact', 'Engineering Services': 'engineering-services', 'Past Projects': 'past-projects', 'Enquiries modal': 'enquiries-modal' }[name]);
  async function savePageLayout(publish = false) { savingPage = true; try { const slug = slugForPage(activePage); const source = cmsPageData[slug] || {}; const updated = await updateCmsPage(slug, { content: activeContent, seo: source.draft_seo || {}, layout: sections }); cmsPageData = { ...cmsPageData, [slug]: updated }; pageContentDrafts = { ...pageContentDrafts, [slug]: clone(updated.draft_content || {}) }; cmsPages = cmsPages.map((page) => page.slug === slug ? { ...page, status: updated.status } : page); if (publish) { const published = await publishCmsPage(slug); cmsPageData = { ...cmsPageData, [slug]: published }; pageContentDrafts = { ...pageContentDrafts, [slug]: clone(published.draft_content || {}) }; cmsPages = cmsPages.map((page) => page.slug === slug ? { ...page, status: published.status } : page); notify(`${activePage} published.`); recordEvent(`Published ${activePage}.`); } else { notify(`${activePage} saved as draft.`); recordEvent(`Saved ${activePage} as a draft.`); } } catch (error) { notify(error?.message || 'Unable to save page layout.', 'error'); recordEvent(`Page save failed: ${error?.message || 'request failed'}`); } finally { savingPage = false; } }
  function moveNavigation(index, direction) { const next = [...navigation]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; navigation = next; }
  function slugify(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function updateNewLabel(value) { newLabel = value; if (!slugEdited) newSlug = slugify(value); }
  async function createPage() { creating = true; try { const sourceSections = creationMode === 'copy' && copySource ? pageDrafts[copySource] : null; const copiedLayout = sourceSections ? clone(sourceSections).map((section) => ({ ...section, id: makeId(), cards: section.cards?.map((card) => ({ ...card, id: makeId() })) })) : null; const created = await createCmsPage({ label: newLabel, slug: newSlug, template: newTemplate, layout: copiedLayout || undefined }); pageNames = [...pageNames, created.label]; pageDrafts = { ...pageDrafts, [created.label]: copiedLayout || pageSections(created.label) }; cmsPageData = { ...cmsPageData, [created.slug]: created }; cmsPages = [...cmsPages, { slug: created.slug, label: created.label, status: created.status }]; activePage = created.label; sections = pageDrafts[activePage]; selectedSectionId = sections[0]?.id || null; createOpen = false; newLabel = ''; newSlug = ''; slugEdited = false; creationMode = 'template'; copySource = ''; notify(`${created.label} created as a draft.`); recordEvent(`Created ${created.label} as a draft.`); } catch (error) { notify(error?.message || 'Unable to create page.', 'error'); } finally { creating = false; } }
  async function deleteCurrentPage() { const slug = slugForPage(activePage); const deletedLabel = activePage; if (!slug || protectedPage || !window.confirm(`Permanently delete “${deletedLabel}”? This cannot be undone.`)) return; try { await deleteCmsPage(slug); const index = pageNames.indexOf(deletedLabel); pageNames = pageNames.filter((name) => name !== deletedLabel); pageDrafts = Object.fromEntries(Object.entries(pageDrafts).filter(([name]) => name !== deletedLabel)); const nextPage = pageNames[Math.max(0, index - 1)] || pageNames[0]; activePage = nextPage; sections = pageDrafts[activePage] || pageSections(activePage); selectedSectionId = sections[0]?.id || null; cmsPages = cmsPages.filter((page) => page.slug !== slug); cmsPageData = Object.fromEntries(Object.entries(cmsPageData).filter(([pageSlug]) => pageSlug !== slug)); notify(`${deletedLabel} deleted.`); recordEvent(`Deleted CMS page ${slug}.`); } catch (error) { notify(error?.message || 'Unable to delete page.', 'error'); } }
</script>

<svelte:head><title>CMS — Internal Facing</title></svelte:head>

<div class="experiment-page">
  <div class="experiment-heading"><div><p class="eyebrow mb-2">Content management</p><h1>CMS page builder</h1><p class="text-body-secondary mb-0">Edit page sections, save drafts, publish content, and manage CMS navigation.</p></div><div class="d-flex gap-2 align-items-center"><button class="btn btn-outline-secondary" type="button" on:click={() => (previewMode = !previewMode)}>{previewMode ? 'Edit layout' : 'Preview page'}</button><button class="btn btn-outline-danger" type="button" on:click={undo} disabled={!undoStack.length}>Undo</button><button class="btn btn-outline-primary" type="button" on:click={() => savePageLayout(false)} disabled={savingPage}>{savingPage ? 'Saving…' : 'Save as draft'}</button><button class="btn btn-primary" type="button" on:click={() => savePageLayout(true)} disabled={savingPage}>Publish</button></div></div>
  {#if notification}<div class={`alert ${notificationType === 'error' ? 'alert-danger' : 'alert-success'} success-toast`} role={notificationType === 'error' ? 'alert' : 'status'} aria-live="polite">{notification}</div>{/if}
  <div class="alert alert-info small"><strong>CMS editor.</strong> Drafts are saved per page. Publishing makes the page available publicly.</div>

  {#if protectedPage && !previewMode}
    <div class="card mb-3 p-3">
      <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h2 class="h6 mb-1">Enquiry context</h2>
          <p class="small text-body-secondary mb-0">Choose which live performance values the enquiry workflow should capture when this modal is submitted.</p>
        </div>
        <span class="badge text-bg-light">Workflow settings</span>
      </div>
      <div class="row g-3 mt-1">
        <div class="col-md-6">
          <label class="context-toggle">
            <input type="checkbox" checked={activeContent.context_fields?.airflow !== false} on:change={(event) => updateContextField('airflow', event.currentTarget.checked)} />
            <span><strong>Airflow</strong><small>Capture the current airflow target or filter value.</small></span>
          </label>
        </div>
        <div class="col-md-6">
          <label class="context-toggle">
            <input type="checkbox" checked={activeContent.context_fields?.pressure !== false} on:change={(event) => updateContextField('pressure', event.currentTarget.checked)} />
            <span><strong>Pressure</strong><small>Capture the current pressure target or filter value.</small></span>
          </label>
        </div>
      </div>
    </div>
  {/if}

  <div class="builder-toolbar card"><div class="toolbar-page-picker"><label class="form-label mb-1" for="builder-page">Editing page</label><select id="builder-page" class="form-select" value={activePage} on:change={selectPage}>{#each pageNames as name}<option value={name}>{name}</option>{/each}</select><button class="btn btn-sm btn-outline-primary mt-2" type="button" on:click={() => (createOpen = true)}>+ New page</button>{#if !protectedPage}<button class="btn btn-sm btn-outline-danger mt-2 ms-2" type="button" on:click={deleteCurrentPage}>Delete page</button>{/if}</div><div class="toolbar-statuses"><strong>CMS page status</strong><div class="status-list">{#each cmsPages as page}<span class:status-live={page.status === 'published'} class="status-item"><span>{page.label}</span><b>{page.status === 'published' ? 'Published' : 'Draft'}</b></span>{/each}</div></div><div class="toolbar-navigation"><strong>CMS navigation order</strong>{#if navigation.length}<div class="nav-order-list">{#each navigation as item, index}<span class="nav-order-item"><span>{index + 1}. {item.label}{#if item.slug}<small class="text-body-secondary d-block">/{item.slug}</small>{:else}<small class="text-primary d-block">custom action</small>{/if}</span><span><button class="btn btn-sm btn-link" type="button" on:click={() => moveNavigation(index, -1)} disabled={index === 0} aria-label={`Move ${item.label} up`}>↑</button><button class="btn btn-sm btn-link" type="button" on:click={() => moveNavigation(index, 1)} disabled={index === navigation.length - 1} aria-label={`Move ${item.label} down`}>↓</button></span></span>{/each}</div><button class="btn btn-sm btn-outline-primary mt-2" type="button" on:click={addEnquiriesNavigationItem}>+ Add Enquiries item</button><button class="btn btn-sm btn-outline-primary mt-2 ms-2" type="button" on:click={saveNavigation}>Save navigation</button>{/if}</div><div class="toolbar-help"><strong>Auto layout</strong><span>Auto sections pack two-across where possible while preserving their order.</span></div></div>

  <div class="builder-layout">
    <aside class="template-panel card"><div class="card-body"><h2 class="h6">Add a section</h2><p class="small text-body-secondary">{protectedPage ? 'The Enquiries modal structure is protected.' : 'Choose a fixed template, then customise its cards and content.'}</p>{#each sectionTypes as template}<button class="template-button" type="button" on:click={() => addSection(template.value)} disabled={protectedPage}><span class="template-icon">{template.value === 'cards' ? '▦' : template.value === 'carousel' ? '◫' : template.value === 'cta' ? '↗' : template.value === 'image-text' ? '▤' : '≡'}</span><span><strong>{template.label}</strong><small>{template.value === 'cards' ? 'Configurable grid' : template.value === 'carousel' ? 'Image slides' : template.value === 'cta' ? 'Opens enquiries' : 'Rich text content'}</small></span><span>+</span></button>{/each}<hr /><p class="small text-body-secondary mb-0"><strong>{sections.length}</strong> sections · <strong>{undoStack.length}</strong> undo step{undoStack.length === 1 ? '' : 's'}</p></div></aside>

    <main><div class="page-canvas-header"><div><span class="small text-body-secondary">{previewMode ? 'Public-style preview' : 'Draft canvas'}</span><h2>{activePage}</h2></div><span class="canvas-status">{previewMode ? 'Preview' : 'Session draft'}</span></div>{#if !previewMode && sections.find((item) => item.id === selectedSectionId)}{@const selectedSection = sections.find((item) => item.id === selectedSectionId)}<div class="card mb-3 p-3"><div class="row g-2 align-items-end"><div class="col-md-5"><label class="form-label" for="selected-section-action-label">Selected section action label</label><input id="selected-section-action-label" class="form-control form-control-sm" value={selectedSection.actionLabel || ''} on:input={(event) => updateSection(sections.findIndex((item) => item.id === selectedSectionId), 'actionLabel', event.currentTarget.value)} /></div><div class="col-md-7"><ActionEditor label="Selected section action" compact value={selectedSection.action || { type: 'none' }} on:change={(event) => updateSectionAction(sections.findIndex((item) => item.id === selectedSectionId), event)} /></div></div></div>{/if}{#if previewMode}<div class="page-preview">{#each sections as section (section.id)}<section class={`preview-section preview-${section.type}`}><div class="preview-content">{#if section.type !== 'cards' && section.type !== 'carousel'}{@html section.content || ''}{:else}<h2>{section.title}</h2><div class="preview-card-grid">{#each section.cards || [] as card}<article class="preview-card">{#if card.image}<img src={card.image} alt="" />{/if}<h3>{card.title}</h3>{@html card.content || ''}</article>{/each}</div>{/if}{#if section.type === 'cta' && section.actionLabel}<button class="btn btn-primary" type="button" on:click={() => recordEvent(`Previewed ${section.actionLabel} action.`)}>{section.actionLabel}</button>{/if}</div></section>{/each}</div>{:else}<div class="page-canvas">
      {#if sections.length === 0}<div class="empty-canvas"><h3>No sections yet</h3><p>Choose a template to start building this page.</p></div>{/if}
      {#each sections as section, sectionIndex (section.id)}
        <div class={`builder-section section-${section.width} ${selectedSectionId === section.id ? 'selected' : ''} ${sectionDropTarget?.index === sectionIndex && sectionDropTarget.position === 'before' ? 'drop-before' : ''} ${sectionDropTarget?.index === sectionIndex && sectionDropTarget.position === 'after' ? 'drop-after' : ''}`} style={paintStyle(section)} role="button" tabindex="0" aria-label={`Select ${section.title} section`} draggable="true" on:dragstart={() => (draggedSection = sectionIndex)} on:dragover={(event) => sectionDragOver(sectionIndex, event)} on:drop={(event) => sectionDrop(sectionIndex, event)} on:dragend={clearSectionDrag} on:click={() => selectSection(section.id)} on:keydown={(event) => selectSectionFromKeyboard(section.id, event)}>
          <div class="section-controls"><div><span class="drag-handle" title="Drag to reorder">⠿</span><span class="section-type">{sectionLabel(section.type)}</span></div><div class="d-flex gap-2 align-items-center"><label class="small text-body-secondary" for={`width-${section.id}`}>Width</label><select id={`width-${section.id}`} class="form-select form-select-sm width-select" value={section.width} on:click|stopPropagation on:change={(event) => updateSection(sectionIndex, 'width', event.currentTarget.value)}><option value="auto">Auto</option><option value="full">Full</option><option value="half">Half</option><option value="third">Third</option></select><button class="btn btn-sm btn-outline-danger" type="button" on:click|stopPropagation={() => removeSection(sectionIndex)} disabled={protectedPage}>Remove</button></div></div>
          <div class="section-fields"><div class="row g-2 mb-3"><div class="col-md-8"><label class="form-label" for={`title-${section.id}`}>Section title</label><input id={`title-${section.id}`} class="form-control" value={section.title} on:input={(event) => updateSection(sectionIndex, 'title', event.currentTarget.value)} /></div>{#if section.type === 'cards'}<div class="col-md-4"><label class="form-label" for={`columns-${section.id}`}>Card grid</label><select id={`columns-${section.id}`} class="form-select" value={section.columns} on:change={(event) => updateSection(sectionIndex, 'columns', Number(event.currentTarget.value))}><option value="1">1 column</option><option value="2">2 columns</option><option value="3">3 columns</option><option value="4">4 columns</option></select></div>{/if}</div>
            {#if section.type === 'cards' || section.type === 'carousel'}<BackgroundControls value={section} label="Section background" compact on:change={(event) => updateSection(sectionIndex, event.detail.field, event.detail.value)} />{#if section.type === 'carousel'}<label class="form-check small mb-3"><input class="form-check-input" type="checkbox" checked={section.autoplay !== false} on:change={(event) => updateSection(sectionIndex, 'autoplay', event.currentTarget.checked)} /> Auto-advance slides</label>{/if}<div class:carousel-editor={section.type === 'carousel'} class="card-list" style={`--card-columns:${section.type === 'carousel' ? 1 : section.columns || 3}`}>{#each section.cards || [] as card, cardIndex (card.id)}<div class="sub-card" style={paintStyle(card)} role="listitem" draggable="true" on:dragstart|stopPropagation={() => (draggedCard = { sectionIndex, cardIndex })} on:dragover|preventDefault on:drop|stopPropagation={(event) => cardDrop(sectionIndex, cardIndex, event)}><div class="sub-card-toolbar"><span class="drag-handle">⠿</span><strong>{section.type === 'carousel' ? `Slide ${cardIndex + 1}` : `Card ${cardIndex + 1}`}</strong><button class="btn btn-sm btn-link text-danger" type="button" on:click={() => removeCard(sectionIndex, cardIndex)} disabled={protectedPage || (section.cards || []).length <= 1}>Remove</button></div><input class="form-control mb-2" aria-label="Card title" value={card.title} on:input={(event) => updateCard(sectionIndex, cardIndex, 'title', event.currentTarget.value)} />{#if card.image}<img class="card-image-preview" src={card.image} alt="" />{/if}<input class="form-control form-control-sm mb-2" aria-label="Card image URL" placeholder="Optional image URL" value={card.image || ''} on:input={(event) => updateCard(sectionIndex, cardIndex, 'image', event.currentTarget.value)} /><RichTextEditor id={`card-${card.id}`} rows={3} value={card.content} on:value={(event) => updateCard(sectionIndex, cardIndex, 'content', event.detail)}><BackgroundControls slot="toolbar-end" value={card} label={section.type === 'carousel' ? `Slide ${cardIndex + 1} background` : `Card ${cardIndex + 1} background`} compact on:change={(event) => updateCard(sectionIndex, cardIndex, event.detail.field, event.detail.value)} /></RichTextEditor><input class="form-control form-control-sm mt-2" aria-label="Card enquiry button label" placeholder="Optional enquiry button label" value={card.ctaLabel || ''} on:input={(event) => updateCard(sectionIndex, cardIndex, 'ctaLabel', event.currentTarget.value)} />{#if card.ctaLabel}<button class="btn btn-sm btn-primary mt-2" type="button" on:click|stopPropagation={() => recordEvent(`Previewed enquiry CTA in ${card.title}.`)}>{card.ctaLabel}</button>{/if}</div>{/each}</div><button class="btn btn-sm btn-outline-primary mt-3" type="button" on:click={() => addCard(sectionIndex)} disabled={protectedPage}>+ Add {section.type === 'carousel' ? 'slide' : 'card'}</button>
            {:else}<RichTextEditor id={`section-${section.id}`} rows={5} value={section.content} on:value={(event) => updateSection(sectionIndex, 'content', event.detail)}><BackgroundControls slot="toolbar-end" value={section} label="Section background" compact on:change={(event) => updateSection(sectionIndex, event.detail.field, event.detail.value)} /></RichTextEditor>{#if section.type === 'image-text'}<div class="mt-3"><label class="form-label" for={`image-${section.id}`}>Section image URL</label><input id={`image-${section.id}`} class="form-control" value={section.image || ''} on:input={(event) => updateSection(sectionIndex, 'image', event.currentTarget.value)} /></div>{/if}<div class="form-text">Rich text supports headings, lists, links, images, font styling, colour, and line spacing.</div>{/if}
          </div>
        </div>
      {/each}
    </div>{/if}</main>
  </div>
  {#if createOpen}
    <div class="cms-modal-backdrop" role="presentation" on:click={(event) => event.target === event.currentTarget && (createOpen = false)}>
      <div class="cms-modal" role="dialog" aria-modal="true" aria-labelledby="new-page-title">
        <div class="d-flex justify-content-between align-items-start gap-3 mb-4"><div><p class="eyebrow mb-1">CMS page</p><h2 id="new-page-title" class="h4 mb-0">Create a new page</h2></div><button class="btn-close" type="button" aria-label="Close" on:click={() => (createOpen = false)}></button></div>
        <div class="mb-3"><label class="form-label" for="new-page-label">Page name</label><input id="new-page-label" class="form-control" value={newLabel} on:input={(event) => updateNewLabel(event.currentTarget.value)} placeholder="e.g. Our approach" /></div>
        <div class="mb-3"><label class="form-label" for="new-page-slug">URL slug</label><input id="new-page-slug" class="form-control" value={newSlug} on:input={(event) => { newSlug = slugify(event.currentTarget.value); slugEdited = true; }} placeholder="our-approach" /><div class="form-text">The page remains private until published.</div></div>
        <div class="mb-3"><label class="form-label" for="new-page-mode">Start with</label><select id="new-page-mode" class="form-select" bind:value={creationMode}><option value="template">A starter template</option><option value="copy">A copy of an existing page</option></select></div>
        {#if creationMode === 'template'}<div class="mb-4"><label class="form-label" for="new-page-template">Starter template</label><select id="new-page-template" class="form-select" bind:value={newTemplate}><option value="standard">Standard page</option><option value="cards">Cards and grid</option><option value="image-text">Image and text</option></select></div>{:else}<div class="mb-4"><label class="form-label" for="copy-page-source">Existing page</label><select id="copy-page-source" class="form-select" bind:value={copySource}><option value="" disabled>Select a page to copy</option>{#each pageNames as name}<option value={name}>{name}</option>{/each}</select><div class="form-text">The page’s current draft layout and content will be copied.</div></div>{/if}
        <div class="d-flex justify-content-end gap-2"><button class="btn btn-outline-secondary" type="button" on:click={() => (createOpen = false)}>Cancel</button><button class="btn btn-primary" type="button" on:click={createPage} disabled={creating || !newLabel.trim() || !newSlug || (creationMode === 'copy' && !copySource)}>{creating ? 'Creating…' : 'Create draft'}</button></div>
      </div>
    </div>
  {/if}
  <details class="cms-events card"><summary>CMS builder messages ({eventLog.length})</summary><div class="cms-events-body">{#if eventLog.length}{#each eventLog as event}<div><time>{event.time}</time><span>{event.message}</span></div>{/each}{:else}<span class="text-body-secondary">Builder events will appear here.</span>{/if}</div></details>
</div>

<style>
  .experiment-page { padding:1.2rem 0 4rem; }.experiment-heading { align-items:end; display:flex; justify-content:space-between; gap:1rem; margin-bottom:1.25rem; }.experiment-heading h1 { letter-spacing:-.04em; }.eyebrow { color:#b91c1c; font-size:.7rem; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }.builder-toolbar { align-items:start; display:grid; grid-template-columns:minmax(180px,1fr) minmax(220px,1.1fr) minmax(220px,1.3fr) minmax(180px,1fr); gap:1rem; justify-content:space-between; margin-bottom:1.25rem; padding:1rem; }.toolbar-statuses,.toolbar-navigation { color:var(--app-text); display:grid; font-size:.75rem; gap:.35rem; }.status-list,.nav-order-list { display:grid; gap:.25rem; }.status-item,.nav-order-item { align-items:center; border:1px solid var(--app-border); border-radius:.35rem; display:flex; justify-content:space-between; gap:.5rem; padding:.25rem .4rem; }.status-item b { color:#b45309; font-size:.65rem; }.status-item.status-live b { color:#15803d; }.nav-order-item .btn { padding:0 .15rem; }.toolbar-help { color:var(--app-muted); display:grid; font-size:.75rem; gap:.2rem; max-width:560px; }.toolbar-help strong { color:var(--app-text); }.builder-layout { align-items:start; display:grid; grid-template-columns:250px minmax(0,1fr); gap:1.25rem; }.template-panel { position:sticky; top:5.5rem; }.template-button { align-items:center; background:transparent; border:1px solid var(--app-border); border-radius:.5rem; color:var(--app-text); display:grid; grid-template-columns:1.6rem 1fr auto; gap:.45rem; margin-bottom:.55rem; padding:.65rem; text-align:left; width:100%; }.template-button:hover { border-color:#b91c1c; background:rgba(185,28,28,.06); }.template-button strong,.template-button small { display:block; }.template-button strong { font-size:.76rem; }.template-button small { color:var(--app-muted); font-size:.65rem; margin-top:.15rem; }.template-icon { color:#b91c1c; font-size:1rem; }.page-canvas-header { align-items:end; display:flex; justify-content:space-between; margin-bottom:.65rem; }.page-canvas-header h2 { font-size:1.25rem; margin:.2rem 0 0; }.canvas-status { border:1px solid #f0c36d; border-radius:999px; color:#9a6700; font-size:.68rem; padding:.3rem .6rem; }.page-canvas { background:var(--app-surface-soft); border:1px solid var(--app-border); border-radius:.7rem; display:grid; grid-auto-flow:row; grid-template-columns:repeat(12,minmax(0,1fr)); gap:.8rem; padding:.8rem; }.builder-section { background:var(--app-surface); border:1px solid var(--app-border); border-radius:.45rem; grid-column:span 6; min-width:0; overflow:hidden; position:relative; transition:box-shadow .12s ease,border-color .12s ease; }.builder-section.section-full { grid-column:span 12; }.builder-section.section-half { grid-column:span 6; }.builder-section.section-third { grid-column:span 4; }.builder-section.selected { border-color:#b91c1c; box-shadow:0 0 0 2px rgba(185,28,28,.12); }.builder-section.drop-before { border-top-color:#b91c1c; box-shadow:inset 0 4px 0 #b91c1c; }.builder-section.drop-after { border-bottom-color:#b91c1c; box-shadow:inset 0 -4px 0 #b91c1c; }.section-controls { align-items:center; background:var(--app-surface-soft); border-bottom:1px solid var(--app-border); display:flex; justify-content:space-between; gap:.5rem; padding:.5rem .65rem; }.drag-handle { color:var(--app-muted); cursor:grab; font-size:1rem; margin-right:.25rem; }.section-type { color:var(--app-muted); font-size:.65rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }.width-select { font-size:.7rem; width:5.6rem; }.section-fields { padding:.85rem; }.section-fields :global(.rich-text-editor__surface) { min-height:6rem; }.background-controls { background:var(--app-surface-soft); border:1px solid var(--app-border); border-radius:.4rem; margin-bottom:.8rem; padding:.65rem; }.background-controls strong { color:var(--app-text); display:block; font-size:.72rem; margin-bottom:.35rem; }.background-controls .form-label { color:var(--app-muted); margin-bottom:.15rem; }.carousel-editor .sub-card { min-height:12rem; }.card-list { display:grid; grid-template-columns:repeat(var(--card-columns),minmax(0,1fr)); gap:.65rem; }.sub-card { background:var(--app-surface); border:1px solid var(--app-border); border-radius:.35rem; min-width:0; padding:.6rem; }.sub-card-toolbar { align-items:center; display:flex; justify-content:space-between; margin-bottom:.45rem; }.sub-card-toolbar strong { font-size:.68rem; }.sub-card-toolbar .btn { font-size:.65rem; padding:0; }.card-image-preview { display:block; height:80px; margin-bottom:.45rem; object-fit:cover; width:100%; }.empty-canvas { grid-column:1/-1; padding:4rem 1rem; text-align:center; }.empty-canvas h3 { font-size:1rem; }.empty-canvas p { color:var(--app-muted); font-size:.8rem; }.cms-events { margin-top:1.25rem; }.cms-events summary { cursor:pointer; padding:.8rem 1rem; font-size:.8rem; font-weight:700; }.cms-events-body { border-top:1px solid var(--app-border); max-height:220px; overflow:auto; padding:.7rem 1rem; }.cms-events-body > div { display:flex; gap:.75rem; padding:.2rem 0; font-size:.72rem; }.cms-events-body time { color:var(--app-muted); flex:0 0 auto; }.cms-modal-backdrop { align-items:center; background:rgba(4,10,18,.72); display:flex; inset:0; justify-content:center; padding:1rem; position:fixed; z-index:1050; }.cms-modal { background:var(--app-surface); border:1px solid var(--app-border); border-radius:.75rem; box-shadow:0 1rem 3rem rgba(0,0,0,.35); color:var(--app-text); max-height:calc(100vh - 2rem); max-width:34rem; overflow:auto; padding:1.25rem; width:100%; }.cms-modal .form-text { color:var(--app-muted); }.cms-modal .btn-close { filter:var(--app-close-filter, none); }
  @media (max-width:900px) { .builder-layout { grid-template-columns:1fr; }.template-panel { position:static; }.template-panel .card-body { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.55rem; }.template-panel h2,.template-panel p,.template-panel hr,.template-panel > .card-body > p:last-child { grid-column:1/-1; }.template-button { margin:0; }.builder-section,.builder-section.section-half,.builder-section.section-third { grid-column:span 12; } }
  @media (max-width:600px) { .experiment-heading,.builder-toolbar { align-items:stretch; flex-direction:column; }.builder-toolbar > div:first-child { min-width:0; }.template-panel .card-body,.card-list { grid-template-columns:1fr; }.section-controls { align-items:flex-start; flex-direction:column; }.section-controls > div:last-child { width:100%; }.width-select { flex:1; }.preview-form-grid { grid-template-columns:1fr 1fr; } }
  .page-preview { background: #f8f9fa; border: 1px solid var(--app-border); border-radius: .7rem; padding: 1.25rem; }.preview-section { background: var(--app-surface); border-radius: .5rem; margin-bottom: 1rem; padding: 1.5rem; }.preview-section:last-child { margin-bottom: 0; }.preview-section h2 { margin-bottom: 1rem; }.preview-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }.preview-card { border: 1px solid var(--app-border); border-radius: .5rem; padding: 1rem; }.preview-card img { display: block; height: 120px; margin: 0 auto 1rem; max-width: 100%; object-fit: contain; }.sub-card input[aria-label="Card enquiry button label"], .sub-card > .btn.btn-primary { display: none; } @media (max-width:700px) { .preview-card-grid { grid-template-columns:1fr; } }
  .context-toggle { align-items:flex-start; border:1px solid var(--app-border); border-radius:.5rem; display:flex; gap:.65rem; padding:.75rem; }.context-toggle input { margin-top:.2rem; }.context-toggle strong,.context-toggle small { display:block; }.context-toggle strong { font-size:.8rem; }.context-toggle small { color:var(--app-muted); font-size:.72rem; margin-top:.15rem; }
</style>
