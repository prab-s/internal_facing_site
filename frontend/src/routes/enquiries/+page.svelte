<script>
  import ManagePageShell from '$lib/editor/ManagePageShell.svelte';
  import { deleteQuoteRequest, updateQuoteRequestStatus } from '$lib/api.js';

  export let data = {};

  let statusFilter = 'all';
  let requestTypeFilter = 'all';
  let searchQuery = '';
  let savingId = null;
  let saveError = '';
  let deletingId = null;

  const requestPathMeta = {
    standard: {
      label: 'Enquire about this item',
      badge: 'text-bg-success',
      description: 'Selected item'
    },
    tailored: {
      label: 'Tailored product',
      badge: 'text-bg-warning',
      description: 'Custom specification'
    },
    unsure: {
      label: 'Not sure yet',
      badge: 'text-bg-info',
      description: 'General enquiry'
    }
  };

  function formatDate(value) {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
  }

  function getRequestPathMeta(value) {
    return requestPathMeta[value] || {
      label: value || 'Unknown',
      badge: 'text-bg-secondary',
      description: 'Unmapped path'
    };
  }

  function helperDetailLabel(key) {
    return {
      thing: 'Looking for', room_size: 'Room or space size', three_phase: 'Three-phase power', constraints: 'Constraints or preferences'
    }[key] || key.replaceAll('_', ' ');
  }

  function filterRecords(records) {
    const needle = searchQuery.trim().toLowerCase();
    return (records || []).filter((record) => {
      if (statusFilter !== 'all' && record.status !== statusFilter) return false;
      if (requestTypeFilter !== 'all' && record.request_type !== requestTypeFilter) return false;
      if (needle) {
        const haystack = [
          record.name,
          record.company,
          record.email,
          record.phone,
          record.page_card_title,
          record.page_title,
          record.page_type,
          record.request_type,
          record.status,
          record.email_status,
          record.acknowledgement_email_status,
          record.verification_status,
          record.page_url,
          record.short_notes,
          record.details,
          JSON.stringify(record.context_json?.enquiry_workflow || {})
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }

  $: records = Array.isArray(data.quoteRequests) ? data.quoteRequests : [];
  $: filteredRecords = filterRecords(records);
  $: totals = {
    all: records.length,
    sent: records.filter((record) => record.email_status === 'sent').length,
    failed: records.filter((record) => record.email_status === 'failed').length,
    verified: records.filter((record) => record.verification_status === 'passed').length
  };

  async function changeStatus(record, nextStatus) {
    saveError = '';
    savingId = record.id;
    try {
      const updated = await updateQuoteRequestStatus(record.id, nextStatus);
      const index = records.findIndex((item) => item.id === record.id);
      if (index !== -1) {
        records[index] = updated;
        records = [...records];
      }
    } catch (error) {
      saveError = error?.message || 'Unable to update enquiry status.';
    } finally {
      savingId = null;
    }
  }

  async function removeRecord(record) {
    if (!window.confirm(`Delete enquiry from ${record.name || record.email || 'this customer'}? This cannot be undone.`)) {
      return;
    }

    saveError = '';
    deletingId = record.id;
    try {
      await deleteQuoteRequest(record.id);
      records = records.filter((item) => item.id !== record.id);
    } catch (error) {
      saveError = error?.message || 'Unable to delete enquiry.';
    } finally {
      deletingId = null;
    }
  }
</script>

<svelte:head>
  <title>Enquiries — Internal Facing</title>
</svelte:head>

<ManagePageShell
  eyebrow="Customer enquiries"
  title="Enquiries"
  description="Review enquiry requests captured from the public site, including verification and email delivery status."
>
  <div class="row g-3 mb-4">
    <div class="col-12 col-md-3">
      <div class="card shadow-sm h-100">
        <div class="card-body">
          <div class="small text-body-secondary text-uppercase fw-semibold mb-1">Total</div>
          <div class="h3 mb-0">{totals.all}</div>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-3">
      <div class="card shadow-sm h-100">
        <div class="card-body">
          <div class="small text-body-secondary text-uppercase fw-semibold mb-1">Email sent</div>
          <div class="h3 mb-0">{totals.sent}</div>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-3">
      <div class="card shadow-sm h-100">
        <div class="card-body">
          <div class="small text-body-secondary text-uppercase fw-semibold mb-1">Email failed</div>
          <div class="h3 mb-0">{totals.failed}</div>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-3">
      <div class="card shadow-sm h-100">
        <div class="card-body">
          <div class="small text-body-secondary text-uppercase fw-semibold mb-1">Verified</div>
          <div class="h3 mb-0">{totals.verified}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="card shadow-sm mb-4">
    <div class="card-body">
      <div class="row g-3 align-items-end">
        <div class="col-md-6">
          <label class="form-label" for="quote-request-search">Search</label>
          <input id="quote-request-search" class="form-control" type="search" bind:value={searchQuery} placeholder="Name, email, product, page, note..." />
        </div>
        <div class="col-md-3">
          <label class="form-label" for="quote-request-status">Workflow status</label>
          <select id="quote-request-status" class="form-select" bind:value={statusFilter}>
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="quoted">Quoted</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label" for="quote-request-type">Request path</label>
          <select id="quote-request-type" class="form-select" bind:value={requestTypeFilter}>
            <option value="all">All request types</option>
            <option value="standard">Enquire about this item</option>
            <option value="tailored">Tailored product</option>
            <option value="unsure">Not sure yet</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  {#if saveError}
    <div class="alert alert-danger">{saveError}</div>
  {/if}

  <div class="enquiries-results">
    <div class="d-flex justify-content-between align-items-center mb-3 px-1">
      <div class="fw-semibold">{filteredRecords.length} {filteredRecords.length === 1 ? 'enquiry' : 'enquiries'}</div>
      <div class="small text-body-secondary">Newest first</div>
    </div>
    {#if filteredRecords.length}
      {#each filteredRecords as record}
        <article class="card shadow-sm enquiry-card mb-3">
          <div class="card-body p-4">
            <div class="d-flex flex-wrap gap-2 justify-content-between align-items-start mb-3">
              <div>
                <div class="small text-body-secondary">Received {formatDate(record.created_at)}</div>
                <h2 class="h5 mb-1">{record.name}</h2>
                <div class="text-body-secondary">{record.company || 'No company provided'}</div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span class={`badge ${getRequestPathMeta(record.request_type).badge}`}>{getRequestPathMeta(record.request_type).label}</span>
                <select class="form-select form-select-sm enquiry-card__status" value={record.status} disabled={savingId === record.id} on:change={(event) => changeStatus(record, event.currentTarget.value)} aria-label="Enquiry status">
                  <option value="new">New</option><option value="quoted">Quoted</option><option value="closed">Closed</option>
                </select>
              </div>
            </div>
            <div class="enquiry-card__grid">
              <section><div class="enquiry-card__label">Contact</div><a href={`mailto:${record.email}`}>{record.email}</a>{#if record.phone}<div>{record.phone}</div>{/if}</section>
              <section><div class="enquiry-card__label">Catalogue context</div><div class="fw-semibold">{record.page_card_title || record.page_title || 'Unknown page'}</div>{#if record.context_json?.product?.model}<div class="small text-body-secondary">Product: {record.context_json.product.model}</div>{/if}{#if record.context_json?.series?.name}<div class="small text-body-secondary">Series: {record.context_json.series.name}</div>{/if}</section>
              <section><div class="enquiry-card__label">Delivery</div><div>Team email <span class={`badge ${record.email_status === 'sent' ? 'text-bg-success' : record.email_status === 'failed' ? 'text-bg-danger' : 'text-bg-secondary'}`}>{record.email_status}</span></div><div class="mt-1">Customer copy <span class={`badge ${record.acknowledgement_email_status === 'sent' ? 'text-bg-success' : record.acknowledgement_email_status === 'failed' ? 'text-bg-danger' : 'text-bg-secondary'}`}>{record.acknowledgement_email_status || 'not sent'}</span></div></section>
            </div>
            <details class="mt-3"><summary>View enquiry details</summary><div class="enquiry-card__details mt-3"><div><strong>Selected stream:</strong> {getRequestPathMeta(record.request_type).label}</div><div><strong>Selected attributes:</strong> {(record.attributes || []).join(', ') || 'None'}</div>{#if record.context_json?.enquiry_workflow?.performance_target?.airflow != null}<div>Airflow target: {record.context_json.enquiry_workflow.performance_target.airflow}</div>{/if}{#if record.context_json?.enquiry_workflow?.performance_target?.pressure != null}<div>Pressure target: {record.context_json.enquiry_workflow.performance_target.pressure}</div>{/if}{#each Object.values(record.context_json?.tailored_requirements || {}) as requirement}<div>{requirement.label}: {requirement.value}</div>{/each}{#each Object.entries(record.context_json?.help_me_choose || {}) as [key, value]}<div>{helperDetailLabel(key)}: {value}</div>{/each}{#if record.graph_image_url}<figure class="enquiry-card__graph"><figcaption class="enquiry-card__label">Submitted performance graph</figcaption><img src={record.graph_image_url} alt="Submitted performance graph with selected duty point" /></figure>{/if}<div class="enquiry-card__notes"><strong>Additional notes</strong><div style="white-space:pre-wrap">{record.short_notes || record.details || 'No notes provided'}</div></div></div></details>
            <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top"><span class={`badge ${record.verification_status === 'passed' ? 'text-bg-success' : 'text-bg-secondary'}`}>Verification: {record.verification_status}</span><button class="btn btn-outline-danger btn-sm" type="button" on:click={() => removeRecord(record)} disabled={deletingId === record.id}>{deletingId === record.id ? 'Deleting...' : 'Delete'}</button></div>
          </div>
        </article>
      {/each}
    {:else}
      <div class="card shadow-sm"><div class="card-body text-center text-body-secondary py-5">No enquiry records match the current filters.</div></div>
    {/if}
  </div>
</ManagePageShell>

<style>
  .enquiry-card__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.5rem; }
  .enquiry-card__label { color: var(--bs-secondary-color); font-size: .72rem; font-weight: 700; letter-spacing: .08em; margin-bottom: .35rem; text-transform: uppercase; }
  .enquiry-card__status { width: auto; min-width: 7rem; }
  .enquiry-card__details { border-left: 3px solid var(--bs-border-color); padding-left: 1rem; }
  .enquiry-card__notes { margin-top: 1.25rem; }
  .enquiry-card__notes strong { display: block; margin-bottom: .45rem; }
  .enquiry-card__graph { margin: 1.25rem 0 0; max-width: 720px; }
  .enquiry-card__graph img { background: #fff; border: 1px solid var(--bs-border-color); border-radius: .5rem; display: block; height: auto; max-width: 100%; }
  @media (max-width: 767px) { .enquiry-card__grid { grid-template-columns: 1fr; gap: 1rem; } }
</style>
