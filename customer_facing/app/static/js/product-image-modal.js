(function () {
  const modalElement = document.getElementById("productImageModal");
  const modalImage = modalElement?.querySelector("[data-product-image-modal-image]");
  const previousButton = modalElement?.querySelector("[data-product-image-previous]");
  const nextButton = modalElement?.querySelector("[data-product-image-next]");
  const imageTriggers = document.querySelectorAll("[data-product-image-trigger]");

  if (!modalElement || !modalImage || !previousButton || !nextButton || !imageTriggers.length || !window.bootstrap?.Modal) return;

  const modal = window.bootstrap.Modal.getOrCreateInstance(modalElement);
  let currentIndex = 0;

  const showImage = (index) => {
    const trigger = imageTriggers[index];
    if (!trigger) return;

    currentIndex = index;
    modalImage.src = trigger.dataset.imageSrc || "";
    modalImage.alt = trigger.dataset.imageAlt || "Product image";
    previousButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex === imageTriggers.length - 1;
  };

  imageTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      showImage(Number(trigger.dataset.imageIndex));
      modal.show(trigger);
    });
  });

  previousButton.addEventListener("click", () => {
    if (currentIndex > 0) showImage(currentIndex - 1);
  });

  nextButton.addEventListener("click", () => {
    if (currentIndex < imageTriggers.length - 1) showImage(currentIndex + 1);
  });

  modalElement.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" && currentIndex > 0) {
      event.preventDefault();
      showImage(currentIndex - 1);
    } else if (event.key === "ArrowRight" && currentIndex < imageTriggers.length - 1) {
      event.preventDefault();
      showImage(currentIndex + 1);
    }
  });

  modalElement.addEventListener("hidden.bs.modal", () => {
    modalImage.src = "";
    modalImage.alt = "";
    currentIndex = 0;
    previousButton.disabled = false;
    nextButton.disabled = false;
  });
})();
