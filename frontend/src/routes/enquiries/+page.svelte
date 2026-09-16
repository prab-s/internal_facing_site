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

  <div class="card shadow-sm">
    <div class="card-body p-0">
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col">Received</th>
              <th scope="col">Customer</th>
              <th scope="col">Context</th>
              <th scope="col">Path</th>
              <th scope="col">Verification</th>
              <th scope="col">Email</th>
              <th scope="col" class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if filteredRecords.length}
              {#each filteredRecords as record}
                <tr>
                  <td class="text-nowrap">{formatDate(record.created_at)}</td>
                  <td>
                    <div class="fw-semibold">{record.name}</div>
                    <div class="small text-body-secondary">{record.company || 'No company provided'}</div>
                    <div class="small"><a href={`mailto:${record.email}`}>{record.email}</a></div>
                    {#if record.phone}
                      <div class="small text-body-secondary">{record.phone}</div>
                    {/if}
                  </td>
                  <td>
                    <div class="fw-semibold">{record.page_card_title || record.page_title || 'Unknown page'}</div>
                    <div class="small text-body-secondary">{record.page_card_summary || record.page_summary || 'No summary provided'}</div>
                    {#if record.context_json?.product?.model}
                      <div class="small">Product: {record.context_json.product.model}</div>
                    {/if}
                    {#if record.context_json?.series?.name}
                      <div class="small">Series: {record.context_json.series.name}</div>
                    {/if}
                    {#if record.context_json?.product_type?.label}
                      <div class="small">Type: {record.context_json.product_type.label}</div>
                    {/if}
                    {#if record.context_json?.enquiry_workflow?.performance_target?.airflow != null}
                      <div class="small">Airflow target: {record.context_json.enquiry_workflow.performance_target.airflow}</div>
                    {/if}
                    {#if record.context_json?.enquiry_workflow?.performance_target?.pressure != null}
                      <div class="small">Pressure target: {record.context_json.enquiry_workflow.performance_target.pressure}</div>
                    {/if}
                  </td>
                  <td>
                    <div class="mb-2">
                      <label class="form-label small text-body-secondary mb-1" for={`quote-status-${record.id}`}>Status</label>
                      <select
                        id={`quote-status-${record.id}`}
                        class="form-select form-select-sm"
                        value={record.status}
                        disabled={savingId === record.id}
                        on:change={(event) => changeStatus(record, event.currentTarget.value)}
                      >
                        <option value="new">New</option>
                        <option value="quoted">Quoted</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div class={`badge ${getRequestPathMeta(record.request_type).badge} mb-2`}>{getRequestPathMeta(record.request_type).label}</div>
                    <div class="small text-body-secondary">{getRequestPathMeta(record.request_type).description}</div>
                    {#if record.page_url}
                      <div class="small text-body-secondary text-break">{record.page_url}</div>
                    {/if}
                    <div class="small text-body-secondary">Attributes: {(record.attributes || []).join(', ') || 'None'}</div>
                    <details class="mt-2">
                      <summary class="small">Details</summary>
                      <div class="small text-body-secondary mt-2" style="white-space: pre-wrap;">{record.short_notes || 'No short notes'}</div>
                      <div class="small mt-2" style="white-space: pre-wrap;">{record.details || 'No extended notes'}</div>
                    </details>
                  </td>
                  <td>
                    <div class={`badge ${record.verification_status === 'passed' ? 'text-bg-success' : record.verification_status === 'not_configured' ? 'text-bg-secondary' : 'text-bg-warning'}`}>{record.verification_status}</div>
                    <div class="small text-body-secondary mt-1">{record.verification_provider}</div>
                    {#if record.client_ip}
                      <div class="small text-body-secondary">{record.client_ip}</div>
                    {/if}
                  </td>
                  <td>
                    <div class={`badge ${record.email_status === 'sent' ? 'text-bg-success' : record.email_status === 'failed' ? 'text-bg-danger' : 'text-bg-secondary'}`}>{record.email_status}</div>
                    {#if record.email_error}
                      <div class="small text-danger mt-1">{record.email_error}</div>
                    {/if}
                  </td>
                  <td class="text-end">
                    <button class="btn btn-outline-danger btn-sm" type="button" on:click={() => removeRecord(record)} disabled={deletingId === record.id}>
                      {deletingId === record.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="7" class="text-center text-body-secondary py-5">
                  No enquiry records match the current filters.
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</ManagePageShell>
