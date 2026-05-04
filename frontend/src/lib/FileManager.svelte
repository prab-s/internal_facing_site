<script>
  import { onMount } from 'svelte';
  import {
    createFileManagerFolder,
    deleteFileManagerEntry,
    downloadFileManagerEntry,
    listFileManagerEntries,
    renameFileManagerEntry,
    uploadFileManagerEntries
  } from '$lib/api.js';

  export let rootName = '';
  export let title = '';
  export let description = '';

  let listing = { root: rootName, path: '', parent_path: null, entries: [] };
  let loading = false;
  let error = '';
  let status = '';
  let createFolderName = '';
  let uploadFiles = [];
  let replaceExisting = false;
  let createInput = null;
  let uploadInput = null;

  onMount(() => {
    loadEntries();
  });

  $: currentPath = listing?.path || '';
  $: pathSegments = currentPath ? currentPath.split('/') : [];
  $: canModifyCurrentFolder = true;

  function formatBytes(value) {
    if (value == null) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = Number(value);
    let unit = units[0];
    for (const nextUnit of units) {
      unit = nextUnit;
      if (size < 1024 || nextUnit === units[units.length - 1]) break;
      size /= 1024;
    }
    return `${size.toFixed(size >= 10 || unit === 'B' ? 0 : 1)} ${unit}`;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  async function loadEntries(nextPath = currentPath) {
    loading = true;
    error = '';
    try {
      listing = await listFileManagerEntries(rootName, nextPath || '');
    } catch (err) {
      error = err?.message || 'Unable to load folder contents.';
    } finally {
      loading = false;
    }
  }

  async function goToPath(nextPath) {
    await loadEntries(nextPath || '');
  }

  async function goUp() {
    await loadEntries(listing?.parent_path || '');
  }

  async function handleCreateFolder() {
    const folderName = createFolderName.trim();
    if (!folderName) return;
    try {
      await createFileManagerFolder(rootName, currentPath, folderName);
      createFolderName = '';
      if (createInput) createInput.value = '';
      status = `Created folder ${folderName}.`;
      await loadEntries(currentPath);
    } catch (err) {
      error = err?.message || 'Unable to create folder.';
    }
  }

  async function handleUpload() {
    const files = Array.from(uploadFiles || []);
    if (!files.length) return;
    try {
      await uploadFileManagerEntries(rootName, currentPath, files, replaceExisting);
      status = files.length === 1 ? `Uploaded ${files[0].name}.` : `Uploaded ${files.length} files.`;
      uploadFiles = [];
      if (uploadInput) uploadInput.value = '';
      await loadEntries(currentPath);
    } catch (err) {
      error = err?.message || 'Unable to upload files.';
    }
  }

  async function handleRename(entry) {
    const newName = window.prompt(`Rename ${entry.name}`, entry.name);
    if (!newName || newName.trim() === entry.name) return;
    try {
      await renameFileManagerEntry(rootName, entry.path, newName.trim());
      status = `Renamed ${entry.name}.`;
      await loadEntries(currentPath);
    } catch (err) {
      error = err?.message || 'Unable to rename item.';
    }
  }

  async function handleDelete(entry) {
    const confirmed = window.confirm(
      entry.type === 'directory'
        ? `Delete folder "${entry.name}" and everything inside it?`
        : `Delete file "${entry.name}"?`
    );
    if (!confirmed) return;
    try {
      await deleteFileManagerEntry(rootName, entry.path, true);
      status = `Deleted ${entry.name}.`;
      await loadEntries(currentPath);
    } catch (err) {
      error = err?.message || 'Unable to delete item.';
    }
  }

  async function handleDownload(entry) {
    try {
      const { blob, filename } = await downloadFileManagerEntry(rootName, entry.path);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      error = err?.message || 'Unable to download file.';
    }
  }

  function handleUploadChange(event) {
    uploadFiles = Array.from(event.currentTarget?.files || []);
  }
</script>

<div class="card border shadow-sm">
  <div class="card-body">
    <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
      <div>
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">{title}</p>
        <h3 class="h5 mb-1">{rootName}/{currentPath || ''}</h3>
        <p class="text-body-secondary mb-0">{description}</p>
      </div>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => loadEntries(currentPath)} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button class="btn btn-outline-secondary btn-sm" type="button" on:click={goUp} disabled={loading || !listing?.parent_path && !currentPath}>
          Up
        </button>
      </div>
    </div>

    {#if error}
      <div class="alert alert-danger py-2 mt-3 mb-0">{error}</div>
    {/if}
    {#if status}
      <div class="alert alert-success py-2 mt-3 mb-0">{status}</div>
    {/if}

    <div class="mt-3">
      <div class="d-flex flex-wrap gap-2 mb-2">
        <span class="badge text-bg-secondary">Root</span>
        {#if pathSegments.length}
          {#each pathSegments as segment, index}
            <button class="btn btn-link btn-sm p-0" type="button" on:click={() => goToPath(pathSegments.slice(0, index + 1).join('/'))}>
              {segment}
            </button>
          {/each}
        {:else}
          <span class="text-body-secondary small">top level</span>
        {/if}
      </div>

      <div class="row g-2 align-items-end">
        <div class="col-12 col-lg-5">
          <label class="form-label form-label-sm" for={`create-folder-${rootName}`}>Create folder</label>
          <input
            bind:this={createInput}
            id={`create-folder-${rootName}`}
            class="form-control form-control-sm"
            type="text"
            bind:value={createFolderName}
            placeholder="New folder name"
            disabled={loading}
          />
        </div>
        <div class="col-12 col-lg-auto">
          <button class="btn btn-outline-primary btn-sm" type="button" on:click={handleCreateFolder} disabled={loading || !createFolderName.trim()}>
            Create Folder
          </button>
        </div>
        <div class="col-12 col-lg">
          <label class="form-label form-label-sm" for={`upload-${rootName}`}>Upload files</label>
          <input
            bind:this={uploadInput}
            id={`upload-${rootName}`}
            class="form-control form-control-sm"
            type="file"
            multiple
            on:change={handleUploadChange}
            disabled={loading}
          />
        </div>
        <div class="col-12 col-lg-auto d-flex align-items-center gap-2">
          <div class="form-check mb-0">
            <input bind:checked={replaceExisting} class="form-check-input" type="checkbox" id={`replace-${rootName}`} disabled={loading || !canModifyCurrentFolder} />
            <label class="form-check-label" for={`replace-${rootName}`}>Replace existing</label>
          </div>
          <button class="btn btn-primary btn-sm" type="button" on:click={handleUpload} disabled={loading || !canModifyCurrentFolder || !uploadFiles.length}>
            Upload
          </button>
        </div>
      </div>
    </div>

    <div class="table-responsive mt-3">
      <table class="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Modified</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each listing?.entries || [] as entry}
            <tr>
              <td>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                  {#if entry.type === 'directory'}
                    <button class="btn btn-link p-0 text-decoration-none" type="button" on:click={() => goToPath(entry.path)}>
                      {entry.name}
                    </button>
                  {:else}
                    <span>{entry.name}</span>
                  {/if}
                  {#if entry.protected}
                    <span class="badge text-bg-warning">Protected</span>
                  {/if}
                </div>
              </td>
              <td class="text-body-secondary text-capitalize">{entry.type}</td>
              <td class="text-body-secondary">{entry.type === 'file' ? formatBytes(entry.size_bytes) : '—'}</td>
              <td class="text-body-secondary">{formatDate(entry.modified_at)}</td>
              <td class="text-end">
                <div class="d-flex justify-content-end gap-2 flex-wrap">
                  {#if entry.type === 'file'}
                    <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => handleDownload(entry)}>Download</button>
                  {/if}
                  <button class="btn btn-outline-primary btn-sm" type="button" on:click={() => handleRename(entry)} disabled={entry.protected}>
                    Rename
                  </button>
                  <button class="btn btn-outline-danger btn-sm" type="button" on:click={() => handleDelete(entry)} disabled={entry.protected}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          {/each}
          {#if !(listing?.entries || []).length}
            <tr>
              <td colspan="5" class="text-body-secondary">This folder is empty.</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
