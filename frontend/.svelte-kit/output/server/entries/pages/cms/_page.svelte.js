import { b as attr, f as attr_style, e as escape_html, i as bind_props, c as attr_class, d as ensure_array_like, h as head, j as clsx } from "../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import { R as RichTextEditor } from "../../../chunks/RichTextEditor.js";
import { f as fallback } from "../../../chunks/equality.js";
function BackgroundControls($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let value = fallback($$props["value"], () => ({}), true);
    let label = fallback($$props["label"], "Background");
    let compact = fallback($$props["compact"], false);
    const fallbackColor = "#ffffff";
    const fallbackGradientColor = "#732323";
    let open = false;
    if (compact) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="background-toolbar-action svelte-5igxar"><button class="btn btn-sm btn-outline-secondary background-toolbar-button svelte-5igxar" type="button"${attr("aria-expanded", open)} aria-haspopup="dialog"><span class="background-toolbar-swatch svelte-5igxar"${attr_style(`background:${value.backgroundColor || "linear-gradient(135deg,#fff,#732323)"}`)} aria-hidden="true"></span> Background</button> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="background-metadata svelte-5igxar"><input class="form-control form-control-sm"${attr("value", value.badge || "")} placeholder="Optional badge"${attr("aria-label", `${label} badge`)}/> <input class="form-control form-control-sm"${attr("value", value.imageAlt || "")} placeholder="Image alt text"${attr("aria-label", `${label} image alt text`)}/></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="background-controls svelte-5igxar"><div class="background-controls__heading svelte-5igxar"><div><strong class="svelte-5igxar">${escape_html(label)}</strong> <span class="svelte-5igxar">Choose a solid colour or a gradient.</span></div> `);
      if (value.backgroundColor) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="background-controls__swatch svelte-5igxar"${attr_style(`background:${value.backgroundColor}`)} aria-hidden="true"></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="background-controls__grid svelte-5igxar"><div class="background-controls__field background-controls__field--colour svelte-5igxar"><label${attr("for", `${label.replaceAll(" ", "-").toLowerCase()}-colour`)} class="svelte-5igxar">Colour</label> <div class="background-controls__colour-input svelte-5igxar"><input${attr("id", `${label.replaceAll(" ", "-").toLowerCase()}-colour`)} class="form-control form-control-color svelte-5igxar" type="color"${attr("value", value.backgroundColor || fallbackColor)}${attr("aria-label", `${label} colour`)}/> <input class="form-control form-control-sm" type="text"${attr("value", value.backgroundColor || "")} placeholder="#ffffff"${attr("aria-label", `${label} colour value`)}/></div></div> <div class="background-controls__field svelte-5igxar"><label${attr("for", `${label.replaceAll(" ", "-").toLowerCase()}-opacity`)} class="svelte-5igxar">Opacity <output class="svelte-5igxar">${escape_html(Math.round((value.backgroundOpacity ?? 1) * 100))}%</output></label> <input${attr("id", `${label.replaceAll(" ", "-").toLowerCase()}-opacity`)} class="form-range" type="range" min="0" max="1" step="0.05"${attr("value", value.backgroundOpacity ?? 1)}${attr("aria-label", `${label} opacity`)}/></div></div> <label class="background-controls__toggle svelte-5igxar"><input class="form-check-input" type="checkbox"${attr("checked", value.gradientEnabled === true, true)}/> <span class="svelte-5igxar"><strong class="svelte-5igxar">Use a gradient</strong><small class="svelte-5igxar">Blend this colour into a second colour.</small></span></label> `);
      if (value.gradientEnabled) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="background-controls__gradient svelte-5igxar"><div class="background-controls__field background-controls__field--colour svelte-5igxar"><label${attr("for", `${label.replaceAll(" ", "-").toLowerCase()}-gradient-colour`)} class="svelte-5igxar">Second colour</label> <div class="background-controls__colour-input svelte-5igxar"><input${attr("id", `${label.replaceAll(" ", "-").toLowerCase()}-gradient-colour`)} class="form-control form-control-color svelte-5igxar" type="color"${attr("value", value.gradientColor || fallbackGradientColor)}${attr("aria-label", `${label} second colour`)}/> <input class="form-control form-control-sm" type="text"${attr("value", value.gradientColor || "")} placeholder="#732323"${attr("aria-label", `${label} second colour value`)}/></div></div> <div class="background-controls__field svelte-5igxar"><label${attr("for", `${label.replaceAll(" ", "-").toLowerCase()}-gradient-angle`)} class="svelte-5igxar">Angle <output class="svelte-5igxar">${escape_html(value.gradientAngle || 90)}°</output></label> <input${attr("id", `${label.replaceAll(" ", "-").toLowerCase()}-gradient-angle`)} class="form-control form-control-sm" type="number" min="0" max="360"${attr("value", value.gradientAngle || 90)}/></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { value, label, compact });
  });
}
function ActionEditor($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let action;
    let value = fallback($$props["value"], null);
    let label = fallback($$props["label"], "Action");
    let compact = fallback($$props["compact"], false);
    const actionTypes = [
      { value: "none", label: "No action" },
      { value: "page", label: "Open CMS page" },
      { value: "modal", label: "Open modal" },
      { value: "external_url", label: "Open external URL" },
      { value: "email", label: "Email address" },
      { value: "event", label: "Dispatch event" }
    ];
    action = { type: "none", ...value || {} };
    $$renderer2.push(`<div${attr_class("action-editor svelte-40nju0", void 0, { "action-editor-compact": compact })}><label class="form-label svelte-40nju0"${attr("for", `${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-type`)}>${escape_html(label)}</label> `);
    $$renderer2.select(
      {
        id: `${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-type`,
        class: "form-select form-select-sm",
        value: action.type
      },
      ($$renderer3) => {
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(actionTypes);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let type = each_array[$$index];
          $$renderer3.option({ value: type.value }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(type.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(` `);
    if (action.type === "page") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<input class="form-control form-control-sm mt-2"${attr("value", action.target || "")} placeholder="/page-slug"${attr("aria-label", `${label} page path`)}/>`);
    } else if (action.type === "modal") {
      $$renderer2.push("<!--[1-->");
      $$renderer2.select(
        {
          class: "form-select form-select-sm mt-2",
          value: action.target || "quoteRequestModal",
          "aria-label": `${label} modal`
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "quoteRequestModal" }, ($$renderer4) => {
            $$renderer4.push(`Enquiries modal`);
          });
        }
      );
      $$renderer2.push(` `);
      $$renderer2.select(
        {
          class: "form-select form-select-sm mt-2",
          value: action.defaultType || "",
          "aria-label": `${label} enquiry type`
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "" }, ($$renderer4) => {
            $$renderer4.push(`Default enquiry type`);
          });
          $$renderer3.option({ value: "standard" }, ($$renderer4) => {
            $$renderer4.push(`Quote this item`);
          });
          $$renderer3.option({ value: "tailored" }, ($$renderer4) => {
            $$renderer4.push(`Tailored product`);
          });
          $$renderer3.option({ value: "unsure" }, ($$renderer4) => {
            $$renderer4.push(`Help me choose`);
          });
        }
      );
      $$renderer2.push(` <div class="action-context-fields mt-2 svelte-40nju0"><span class="small text-body-secondary">Pass through to enquiry</span><label class="svelte-40nju0"><input type="checkbox"${attr("checked", action.contextFields?.airflow !== false, true)}/> Airflow</label><label class="svelte-40nju0"><input type="checkbox"${attr("checked", action.contextFields?.pressure !== false, true)}/> Pressure</label></div>`);
    } else if (action.type === "external_url" || action.type === "email" || action.type === "event") {
      $$renderer2.push("<!--[2-->");
      $$renderer2.push(`<input class="form-control form-control-sm mt-2"${attr("value", action.target || "")}${attr("placeholder", action.type === "event" ? "event-name" : action.type === "email" ? "mailto:team@example.com" : "https://example.com")}${attr("aria-label", `${label} target`)}/>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, { value, label, compact });
  });
}
function SectionAppearanceControls($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let isCardGrid, isCarousel, isAccordion, sectionImageEnabled, cardImagesEnabled, canHaveImageSettings, hasActions;
    let value = fallback($$props["value"], () => ({}), true);
    isCardGrid = value.type === "cards";
    isCarousel = value.type === "carousel";
    isAccordion = value.type === "accordion";
    sectionImageEnabled = value.type === "image-text" && (value.showImage === true || Boolean(value.image && value.showImage !== false));
    cardImagesEnabled = (isCardGrid || isCarousel) && (value.showCardImages === true || Boolean((value.cards || []).some((card) => card.image) && value.showCardImages !== false));
    canHaveImageSettings = sectionImageEnabled || cardImagesEnabled;
    hasActions = value.type === "cta" || Boolean(value.actionLabel || value.secondaryActionLabel || value.action || value.secondaryAction);
    $$renderer2.push(`<div class="appearance-controls svelte-1ufmzqy"><section class="svelte-1ufmzqy"><h3 class="svelte-1ufmzqy">Layout and surface</h3> <div class="control-grid svelte-1ufmzqy"><label class="svelte-1ufmzqy">Section width`);
    $$renderer2.select(
      {
        class: "form-select form-select-sm",
        value: value.width || "auto"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "auto" }, ($$renderer4) => {
          $$renderer4.push(`Auto`);
        });
        $$renderer3.option({ value: "full" }, ($$renderer4) => {
          $$renderer4.push(`Full`);
        });
        $$renderer3.option({ value: "half" }, ($$renderer4) => {
          $$renderer4.push(`Half`);
        });
        $$renderer3.option({ value: "third" }, ($$renderer4) => {
          $$renderer4.push(`Third`);
        });
      }
    );
    $$renderer2.push(`</label> <label class="svelte-1ufmzqy">Style`);
    $$renderer2.select(
      {
        class: "form-select form-select-sm",
        value: value.surface || "card"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "card" }, ($$renderer4) => {
          $$renderer4.push(`Card`);
        });
        $$renderer3.option({ value: "plain" }, ($$renderer4) => {
          $$renderer4.push(`Plain`);
        });
      }
    );
    $$renderer2.push(`</label> <label class="svelte-1ufmzqy">Tone`);
    $$renderer2.select(
      {
        class: "form-select form-select-sm",
        value: value.tone || "default"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "default" }, ($$renderer4) => {
          $$renderer4.push(`Default`);
        });
        $$renderer3.option({ value: "soft" }, ($$renderer4) => {
          $$renderer4.push(`Soft`);
        });
        $$renderer3.option({ value: "dark" }, ($$renderer4) => {
          $$renderer4.push(`Dark`);
        });
        $$renderer3.option({ value: "brand" }, ($$renderer4) => {
          $$renderer4.push(`Brand`);
        });
      }
    );
    $$renderer2.push(`</label> <label class="svelte-1ufmzqy">Spacing`);
    $$renderer2.select(
      {
        class: "form-select form-select-sm",
        value: value.spacing || "md"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "none" }, ($$renderer4) => {
          $$renderer4.push(`None`);
        });
        $$renderer3.option({ value: "sm" }, ($$renderer4) => {
          $$renderer4.push(`Small`);
        });
        $$renderer3.option({ value: "md" }, ($$renderer4) => {
          $$renderer4.push(`Medium`);
        });
        $$renderer3.option({ value: "lg" }, ($$renderer4) => {
          $$renderer4.push(`Large`);
        });
      }
    );
    $$renderer2.push(`</label> <label class="svelte-1ufmzqy">Text alignment`);
    $$renderer2.select(
      {
        class: "form-select form-select-sm",
        value: value.textAlign || "start"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "start" }, ($$renderer4) => {
          $$renderer4.push(`Left`);
        });
        $$renderer3.option({ value: "center" }, ($$renderer4) => {
          $$renderer4.push(`Centre`);
        });
        $$renderer3.option({ value: "end" }, ($$renderer4) => {
          $$renderer4.push(`Right`);
        });
      }
    );
    $$renderer2.push(`</label> <label class="svelte-1ufmzqy">Heading size`);
    $$renderer2.select(
      {
        class: "form-select form-select-sm",
        value: value.headingSize || "normal"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "normal" }, ($$renderer4) => {
          $$renderer4.push(`Normal`);
        });
        $$renderer3.option({ value: "display" }, ($$renderer4) => {
          $$renderer4.push(`Display`);
        });
      }
    );
    $$renderer2.push(`</label> <label class="svelte-1ufmzqy">Corner radius`);
    $$renderer2.select(
      {
        class: "form-select form-select-sm",
        value: value.radius || "lg"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "none" }, ($$renderer4) => {
          $$renderer4.push(`None`);
        });
        $$renderer3.option({ value: "sm" }, ($$renderer4) => {
          $$renderer4.push(`Small`);
        });
        $$renderer3.option({ value: "lg" }, ($$renderer4) => {
          $$renderer4.push(`Large`);
        });
      }
    );
    $$renderer2.push(`</label> <label class="svelte-1ufmzqy">Shadow`);
    $$renderer2.select(
      {
        class: "form-select form-select-sm",
        value: value.shadow || "none"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "none" }, ($$renderer4) => {
          $$renderer4.push(`None`);
        });
        $$renderer3.option({ value: "sm" }, ($$renderer4) => {
          $$renderer4.push(`Small`);
        });
        $$renderer3.option({ value: "lg" }, ($$renderer4) => {
          $$renderer4.push(`Large`);
        });
      }
    );
    $$renderer2.push(`</label></div> <label class="toggle svelte-1ufmzqy"><input type="checkbox"${attr("checked", value.border === true, true)} class="svelte-1ufmzqy"/> Show border</label></section> `);
    if (isCardGrid) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="svelte-1ufmzqy"><h3 class="svelte-1ufmzqy">Card grid</h3> <div class="control-grid svelte-1ufmzqy"><label class="svelte-1ufmzqy">Tablet columns`);
      $$renderer2.select(
        {
          class: "form-select form-select-sm",
          value: value.tabletColumns || 2
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "1" }, ($$renderer4) => {
            $$renderer4.push(`One`);
          });
          $$renderer3.option({ value: "2" }, ($$renderer4) => {
            $$renderer4.push(`Two`);
          });
          $$renderer3.option({ value: "3" }, ($$renderer4) => {
            $$renderer4.push(`Three`);
          });
          $$renderer3.option({ value: "4" }, ($$renderer4) => {
            $$renderer4.push(`Four`);
          });
        }
      );
      $$renderer2.push(`</label> <label class="svelte-1ufmzqy">Card style`);
      $$renderer2.select(
        {
          class: "form-select form-select-sm",
          value: value.cardStyle || "raised"
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "raised" }, ($$renderer4) => {
            $$renderer4.push(`Raised`);
          });
          $$renderer3.option({ value: "outline" }, ($$renderer4) => {
            $$renderer4.push(`Outline`);
          });
          $$renderer3.option({ value: "minimal" }, ($$renderer4) => {
            $$renderer4.push(`Minimal`);
          });
        }
      );
      $$renderer2.push(`</label></div></section>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (isCardGrid || isCarousel) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="svelte-1ufmzqy"><h3 class="svelte-1ufmzqy">Card images</h3> <label class="toggle svelte-1ufmzqy"><input type="checkbox"${attr("checked", cardImagesEnabled, true)} class="svelte-1ufmzqy"/> Show images in ${escape_html(isCarousel ? "slides" : "cards")}</label> `);
      if (!cardImagesEnabled) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="hint svelte-1ufmzqy">Turn this on to add an image URL to each ${escape_html(isCarousel ? "slide" : "card")}.</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></section>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (value.type === "image-text") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="svelte-1ufmzqy"><h3 class="svelte-1ufmzqy">Section image</h3> <label class="toggle svelte-1ufmzqy"><input type="checkbox"${attr("checked", sectionImageEnabled, true)} class="svelte-1ufmzqy"/> Include an image alongside the text</label> `);
      if (!sectionImageEnabled) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="hint svelte-1ufmzqy">Turn this on to add and position an image. Your text-only section will remain unchanged until then.</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></section>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (canHaveImageSettings) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="svelte-1ufmzqy"><h3 class="svelte-1ufmzqy">${escape_html(sectionImageEnabled ? "Image display" : "Card images")}</h3> <div class="control-grid svelte-1ufmzqy"><label class="svelte-1ufmzqy">Image fit`);
      $$renderer2.select(
        {
          class: "form-select form-select-sm",
          value: value.imageFit || "cover"
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "cover" }, ($$renderer4) => {
            $$renderer4.push(`Crop to fill`);
          });
          $$renderer3.option({ value: "contain" }, ($$renderer4) => {
            $$renderer4.push(`Fit whole image`);
          });
        }
      );
      $$renderer2.push(`</label> <label class="svelte-1ufmzqy">Image ratio`);
      $$renderer2.select(
        {
          class: "form-select form-select-sm",
          value: value.imageRatio || "square"
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "wide" }, ($$renderer4) => {
            $$renderer4.push(`Wide`);
          });
          $$renderer3.option({ value: "square" }, ($$renderer4) => {
            $$renderer4.push(`Square`);
          });
          $$renderer3.option({ value: "portrait" }, ($$renderer4) => {
            $$renderer4.push(`Portrait`);
          });
        }
      );
      $$renderer2.push(`</label> `);
      if (sectionImageEnabled) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<label class="svelte-1ufmzqy">Image position`);
        $$renderer2.select(
          {
            class: "form-select form-select-sm",
            value: value.imagePosition || "right"
          },
          ($$renderer3) => {
            $$renderer3.option({ value: "left" }, ($$renderer4) => {
              $$renderer4.push(`Left`);
            });
            $$renderer3.option({ value: "right" }, ($$renderer4) => {
              $$renderer4.push(`Right`);
            });
          }
        );
        $$renderer2.push(`</label>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      if (sectionImageEnabled) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<label class="svelte-1ufmzqy">Image alt text<input class="form-control form-control-sm"${attr("value", value.imageAlt || "")}/></label> <label class="svelte-1ufmzqy">Image caption<input class="form-control form-control-sm"${attr("value", value.imageCaption || "")}/></label>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></section>`);
    } else if (isCardGrid || isCarousel) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<p class="hint svelte-1ufmzqy">Add an image in the content editor to reveal its display settings.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (isAccordion) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="svelte-1ufmzqy"><h3 class="svelte-1ufmzqy">Accordion behaviour</h3> <label class="toggle svelte-1ufmzqy"><input type="checkbox"${attr("checked", value.openFirst === true, true)} class="svelte-1ufmzqy"/> Open the first item initially</label> <label class="toggle svelte-1ufmzqy"><input type="checkbox"${attr("checked", value.alwaysOpen === true, true)} class="svelte-1ufmzqy"/> Keep one item open</label> <label class="svelte-1ufmzqy">Items (JSON)<textarea class="form-control form-control-sm" rows="5">`);
      const $$body = escape_html(JSON.stringify(value.cards || [], null, 2));
      if ($$body) {
        $$renderer2.push(`${$$body}`);
      }
      $$renderer2.push(`</textarea></label></section>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (hasActions) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="svelte-1ufmzqy"><h3 class="svelte-1ufmzqy">Secondary action</h3> <label class="svelte-1ufmzqy">Secondary button style`);
      $$renderer2.select(
        {
          class: "form-select form-select-sm",
          value: value.secondaryButtonVariant || "outline-secondary"
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "primary" }, ($$renderer4) => {
            $$renderer4.push(`Primary`);
          });
          $$renderer3.option({ value: "outline-secondary" }, ($$renderer4) => {
            $$renderer4.push(`Outline`);
          });
          $$renderer3.option({ value: "light" }, ($$renderer4) => {
            $$renderer4.push(`Light`);
          });
          $$renderer3.option({ value: "outline-light" }, ($$renderer4) => {
            $$renderer4.push(`Light outline`);
          });
        }
      );
      $$renderer2.push(`</label> <label class="svelte-1ufmzqy">Button size`);
      $$renderer2.select(
        {
          class: "form-select form-select-sm",
          value: value.buttonSize || "lg"
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "sm" }, ($$renderer4) => {
            $$renderer4.push(`Small`);
          });
          $$renderer3.option({ value: "md" }, ($$renderer4) => {
            $$renderer4.push(`Medium`);
          });
          $$renderer3.option({ value: "lg" }, ($$renderer4) => {
            $$renderer4.push(`Large`);
          });
        }
      );
      $$renderer2.push(`</label> <label class="svelte-1ufmzqy">Secondary button label<input class="form-control form-control-sm"${attr("value", value.secondaryActionLabel || "")}/></label> <div class="action-field svelte-1ufmzqy">`);
      ActionEditor($$renderer2, {
        label: "Secondary button action",
        compact: true,
        value: value.secondaryAction || { type: "none" }
      });
      $$renderer2.push(`<!----></div></section>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, { value });
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let protectedPage, activePageSlug, activeContent;
    let pageNames = [
      "About Us",
      "Contact",
      "Engineering Services",
      "Past Projects"
    ];
    const sectionTypes = [
      { value: "rich-text", label: "Rich text" },
      { value: "cards", label: "Cards / grid" },
      { value: "image-text", label: "Image and text" },
      { value: "carousel", label: "Carousel" },
      { value: "accordion", label: "Accordion" },
      { value: "cta", label: "Enquiry CTA" }
    ];
    const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const rich = (title, text) => ({
      id: makeId(),
      type: "rich-text",
      title,
      width: "full",
      columns: 1,
      content: `<h2>${title}</h2><p>${text}</p>`
    });
    const enquiryAction = (defaultType = "") => ({
      type: "modal",
      target: "quoteRequestModal",
      ...defaultType ? { defaultType } : {}
    });
    const cards = (title, items, width = "full", columns = 3) => ({
      id: makeId(),
      type: "cards",
      title,
      width,
      columns,
      content: "",
      cards: items.map(([cardTitle, text, image = ""]) => ({
        id: makeId(),
        title: cardTitle,
        content: `<p>${text}</p>`,
        image
      }))
    });
    const cta = (title, text) => ({
      id: makeId(),
      type: "cta",
      title,
      width: "full",
      columns: 1,
      content: `<h2>${title}</h2><p>${text}</p>`,
      actionLabel: "Make an enquiry",
      action: enquiryAction()
    });
    function pageSections(page) {
      if (page === "About Us") return [
        rich("Engineering better air movement", "Practical products, thoughtful engineering, and people who care about the details."),
        rich("Our story", "Vent-Tech was established to help customers find dependable air-management and ventilation products without unnecessary complexity."),
        cards("What matters to us", [
          [
            "Be useful",
            "Make product information clear and keep the next step easy to understand."
          ],
          [
            "Build with care",
            "Pay attention to materials, measurements, finishes, and the small details."
          ],
          [
            "Keep improving",
            "Learn from every project and keep refining the customer experience."
          ]
        ]),
        cards(
          "The people behind the work",
          [
            ["Team member one", "Placeholder role and biography."],
            ["Team member two", "Placeholder role and biography."],
            ["Team member three", "Placeholder role and biography."]
          ],
          "half",
          3
        ),
        cards(
          "How we help",
          [
            [
              "Listen",
              "Understand the application, constraints, and desired outcome."
            ],
            [
              "Recommend",
              "Point customers toward suitable products or services."
            ],
            [
              "Support",
              "Provide documentation, technical context, and practical guidance."
            ],
            [
              "Follow through",
              "Keep communication clear from enquiry through delivery."
            ]
          ],
          "half",
          2
        ),
        cta("Have a question about a product, project, or custom requirement?", "Invite the customer to open the Enquiries modal.")
      ];
      if (page === "Contact") return [
        rich("Talk to Vent-Tech about selection, pricing, or project support", "Use the team below for direct help with product selection, quoting, and documentation."),
        cards(
          "Request a quote and visit us",
          [
            [
              "Request a quote",
              "Send the project details through and the team can point you to the right next step."
            ],
            [
              "Vent-Tech 2018 Ltd.",
              "576c Fergusson Drive, Upper Hutt 5018, Wellington.",
              "/static/media/venttech_shop_front.jpg"
            ]
          ],
          "half",
          2
        ),
        cards(
          "Direct contacts",
          [
            [
              "Admin",
              "Shop — general · admin@venttech.co.nz · 04 595 1403"
            ],
            ["Gerald Keown", "Managing Director · gerald@venttech.co.nz"],
            [
              "Nilesh Patel",
              "Design / Technical / Sales · nilesh@venttech.co.nz"
            ],
            ["Alex Keown", "Operations Manager · alex@venttech.co.nz"],
            [
              "Mahendra Dahya",
              "Technical / Sales · mahendra@venttech.co.nz"
            ]
          ],
          "full",
          3
        ),
        cta("Need help choosing the right route?", "Open the Enquiries modal and tell us what you need.")
      ];
      if (page === "Engineering Services") return [
        rich("Fabrication support for custom metalwork and project build-outs", "Our engineering services cover the practical workshop processes that turn flat material into usable parts."),
        cards(
          "Workshop capabilities",
          [
            [
              "Workshop capabilities",
              "Laser cutting<br>Brake pressing<br>Rolling<br>Flanging"
            ]
          ],
          "half",
          1
        ),
        rich("Reliable workshop processes that support fabrication and product development", "Engineering services are often the bridge between design intent and a finished component. We can help with one-off parts and custom fabrication requirements."),
        cards(
          "Our service areas",
          [
            [
              "Laser cutting",
              "Repeatable cut profiles and efficient sheet utilisation.",
              "/static/media/laser-cutter.svg"
            ],
            [
              "Brake pressing",
              "Accurate bends and formed panels.",
              "/static/media/brake-press.svg"
            ],
            [
              "Rolling",
              "Controlled curved sections and repeatable radii.",
              "/static/media/roller.svg"
            ],
            [
              "Flanging",
              "Stiffened component edges and neat assembly details.",
              "/static/media/flanger.svg"
            ]
          ],
          "full",
          4
        ),
        cta("Need something made for a specific space, duty, or application?", "Share your dimensions, drawings, photos, or performance requirements with the team.")
      ];
      if (page === "Past Projects") return [
        rich("A quick look at previous project highlights", "Finished jobs, case studies, before-and-after examples, and the outcomes customers can expect."),
        cards(
          "Project collage",
          [
            [
              "Laser cutting",
              "Precision sheet work and repeatable cut profiles.",
              "/static/media/laser-cutter.svg"
            ],
            [
              "Brake pressing",
              "Clean folds, returns, and formed sections.",
              "/static/media/brake-press.svg"
            ],
            [
              "Rolling",
              "Curved sections and controlled radii.",
              "/static/media/roller.svg"
            ],
            [
              "Flanging",
              "Stiffened edges and tidy assembly details.",
              "/static/media/flanger.svg"
            ]
          ],
          "full",
          4
        ),
        cards(
          "Project context",
          [
            [
              "Short, visual summaries",
              "The problem to solve and the finished result."
            ],
            [
              "Examples by sector",
              "Ventilation, fabrication support, commercial builds, and custom engineering."
            ],
            [
              "A few useful details",
              "Project goals, fabrication steps, and notable outcomes."
            ]
          ],
          "full",
          3
        ),
        cta("Want to discuss a similar project?", "Open the Enquiries modal and tell us about the job.")
      ];
      if (page !== "Enquiries modal") return [
        rich(page, "Add the approved content for this new page."),
        cta("Ready to talk?", "Invite customers to open the Enquiries modal.")
      ];
      return [
        rich("Tell us what you need", "Choose the option that best describes what you need and we’ll route your enquiry to the right person."),
        cards(
          "How should we quote this?",
          [
            [
              "Quote this item",
              "Use the current product or series as the starting point."
            ],
            [
              "Tailored product",
              "I need something that does not exist in the current catalogue."
            ],
            [
              "Help me choose",
              "Answer a few quick questions and we’ll point you in the right direction."
            ]
          ],
          "full",
          3
        ),
        rich("Your enquiry will be sent directly to the Vent-Tech team.", "The form collects your contact details and any project context you can share.")
      ];
    }
    let activePage = pageNames[0];
    let pageDrafts = Object.fromEntries(pageNames.map((name) => [name, pageSections(name)]));
    let sections = pageDrafts[activePage];
    let undoStack = [];
    let sectionDropTarget = null;
    let selectedSectionId = sections[0].id;
    let cmsPages = [];
    let cmsPageData = {};
    let pageContentDrafts = {};
    let navigation = [];
    let eventLog = [];
    let savingPage = false;
    let previewMode = false;
    function paintStyle(item) {
      const color = item?.backgroundColor;
      if (!color) return "";
      const opacity = Math.max(0, Math.min(1, Number(item.backgroundOpacity ?? 1)));
      const first = `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)`;
      if (item.gradientEnabled && item.gradientColor) {
        const second = `color-mix(in srgb, ${item.gradientColor} ${opacity * 100}%, transparent)`;
        return `background:linear-gradient(${Number(item.gradientAngle || 90)}deg, ${first}, ${second});`;
      }
      return `background:${first};`;
    }
    function sectionLabel(type) {
      return sectionTypes.find((item) => item.value === type)?.label || "Section";
    }
    const slugForPage = (name) => cmsPages.find((page) => page.label === name)?.slug || {
      "About Us": "about-us",
      Contact: "contact",
      "Engineering Services": "engineering-services",
      "Past Projects": "past-projects"
    }[name];
    protectedPage = activePage === "Enquiries modal";
    activePageSlug = slugForPage(activePage);
    activeContent = pageContentDrafts[activePageSlug] || cmsPageData[activePageSlug]?.draft_content || {};
    head("17dfpeu", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>CMS — Internal Facing</title>`);
      });
    });
    $$renderer2.push(`<div class="experiment-page svelte-17dfpeu"><div class="experiment-heading svelte-17dfpeu"><div><p class="eyebrow mb-2 svelte-17dfpeu">Content management</p><h1 class="svelte-17dfpeu">CMS page builder</h1><p class="text-body-secondary mb-0">Edit page sections, save drafts, publish content, and manage CMS navigation.</p></div><div class="d-flex gap-2 align-items-center"><button class="btn btn-outline-secondary" type="button">${escape_html("Preview page")}</button><button class="btn btn-outline-danger" type="button"${attr("disabled", !undoStack.length, true)}>Undo</button><button class="btn btn-outline-primary" type="button"${attr("disabled", savingPage, true)}>${escape_html("Save as draft")}</button><button class="btn btn-primary" type="button"${attr("disabled", savingPage, true)}>Publish</button></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="alert alert-info small"><strong>CMS editor.</strong> Drafts are saved per page. Publishing makes the page available publicly.</div> `);
    if (protectedPage && !previewMode) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card mb-3 p-3"><div class="d-flex justify-content-between align-items-start gap-3 flex-wrap"><div><h2 class="h6 mb-1">Enquiry context</h2> <p class="small text-body-secondary mb-0">Choose which live performance values the enquiry workflow should capture when this modal is submitted.</p></div> <span class="badge text-bg-light">Workflow settings</span></div> <div class="row g-3 mt-1"><div class="col-md-6"><label class="context-toggle svelte-17dfpeu"><input type="checkbox"${attr("checked", activeContent.context_fields?.airflow !== false, true)} class="svelte-17dfpeu"/> <span><strong class="svelte-17dfpeu">Airflow</strong><small class="svelte-17dfpeu">Capture the current airflow target or filter value.</small></span></label></div> <div class="col-md-6"><label class="context-toggle svelte-17dfpeu"><input type="checkbox"${attr("checked", activeContent.context_fields?.pressure !== false, true)} class="svelte-17dfpeu"/> <span><strong class="svelte-17dfpeu">Pressure</strong><small class="svelte-17dfpeu">Capture the current pressure target or filter value.</small></span></label></div></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="builder-toolbar card svelte-17dfpeu"><div class="toolbar-page-picker svelte-17dfpeu"><label class="form-label mb-1" for="builder-page">Editing page</label>`);
    $$renderer2.select({ id: "builder-page", class: "form-select", value: activePage }, ($$renderer3) => {
      $$renderer3.push(`<!--[-->`);
      const each_array = ensure_array_like(pageNames);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let name = each_array[$$index];
        $$renderer3.option({ value: name }, ($$renderer4) => {
          $$renderer4.push(`${escape_html(name)}`);
        });
      }
      $$renderer3.push(`<!--]-->`);
    });
    $$renderer2.push(`<button class="btn btn-sm btn-outline-primary mt-2" type="button">+ New page</button>`);
    if (!protectedPage) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="btn btn-sm btn-outline-danger mt-2 ms-2" type="button">Delete page</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div><div class="toolbar-statuses svelte-17dfpeu"><strong>CMS page status</strong><div class="status-list svelte-17dfpeu"><!--[-->`);
    const each_array_1 = ensure_array_like(cmsPages);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let page = each_array_1[$$index_1];
      $$renderer2.push(`<span${attr_class("status-item svelte-17dfpeu", void 0, { "status-live": page.status === "published" })}><span>${escape_html(page.label)}</span><b class="svelte-17dfpeu">${escape_html(page.status === "published" ? "Published" : "Draft")}</b></span>`);
    }
    $$renderer2.push(`<!--]--></div></div><div class="toolbar-navigation svelte-17dfpeu"><strong>Page visibility and order</strong>`);
    if (navigation.length) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="nav-order-list svelte-17dfpeu"><!--[-->`);
      const each_array_2 = ensure_array_like(navigation);
      for (let index = 0, $$length = each_array_2.length; index < $$length; index++) {
        let item = each_array_2[index];
        $$renderer2.push(`<span class="nav-order-item svelte-17dfpeu"><span>${escape_html(index + 1)}. ${escape_html(item.label)}`);
        if (item.slug) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<small class="text-body-secondary d-block">/${escape_html(item.slug)}</small>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<small class="text-primary d-block">custom action</small>`);
        }
        $$renderer2.push(`<!--]--></span><span class="nav-visibility svelte-17dfpeu"><label class="svelte-17dfpeu"><input type="checkbox"${attr("checked", item.show_in_nav !== false, true)}/> Nav</label><label class="svelte-17dfpeu"><input type="checkbox"${attr("checked", item.show_in_footer === true, true)}/> Quick links</label></span><span><button class="btn btn-sm btn-link svelte-17dfpeu" type="button"${attr("disabled", index === 0, true)}${attr("aria-label", `Move ${item.label} up`)}>↑</button><button class="btn btn-sm btn-link svelte-17dfpeu" type="button"${attr("disabled", index === navigation.length - 1, true)}${attr("aria-label", `Move ${item.label} down`)}>↓</button></span></span>`);
      }
      $$renderer2.push(`<!--]--></div><button class="btn btn-sm btn-outline-primary mt-2" type="button">+ Add Enquiries item</button><button class="btn btn-sm btn-outline-primary mt-2 ms-2" type="button">Save visibility and order</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div><div class="toolbar-help svelte-17dfpeu"><strong class="svelte-17dfpeu">Auto layout</strong><span>Auto sections pack two-across where possible while preserving their order.</span></div></div> <div${attr_class("builder-layout svelte-17dfpeu", void 0, { "preview-layout": previewMode })}><aside class="template-panel card svelte-17dfpeu"><div class="card-body svelte-17dfpeu">`);
    if (sections.find((item) => item.id === selectedSectionId)) {
      $$renderer2.push("<!--[0-->");
      const selectedTypeSection = sections.find((item) => item.id === selectedSectionId);
      $$renderer2.push(`<div class="selected-type-control svelte-17dfpeu"><label class="form-label small mb-1">Selected section type</label>`);
      $$renderer2.select(
        {
          class: "form-select form-select-sm",
          value: selectedTypeSection.type || "rich-text",
          disabled: previewMode
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "rich-text" }, ($$renderer4) => {
            $$renderer4.push(`Rich text`);
          });
          $$renderer3.option({ value: "cards" }, ($$renderer4) => {
            $$renderer4.push(`Cards`);
          });
          $$renderer3.option({ value: "image-text" }, ($$renderer4) => {
            $$renderer4.push(`Image and text`);
          });
          $$renderer3.option({ value: "carousel" }, ($$renderer4) => {
            $$renderer4.push(`Carousel`);
          });
          $$renderer3.option({ value: "accordion" }, ($$renderer4) => {
            $$renderer4.push(`Accordion`);
          });
          $$renderer3.option({ value: "cta" }, ($$renderer4) => {
            $$renderer4.push(`Call to action`);
          });
        }
      );
      $$renderer2.push(`</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--><h2 class="h6 svelte-17dfpeu">Add a section</h2><p class="small text-body-secondary svelte-17dfpeu">${escape_html(protectedPage ? "The Enquiries modal structure is protected." : "Choose a fixed template, then customise its cards and content.")}</p><!--[-->`);
    const each_array_3 = ensure_array_like(sectionTypes);
    for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
      let template = each_array_3[$$index_3];
      $$renderer2.push(`<button class="template-button svelte-17dfpeu" type="button"${attr("disabled", protectedPage, true)}><span class="template-icon svelte-17dfpeu">${escape_html(template.value === "cards" ? "▦" : template.value === "carousel" ? "◫" : template.value === "cta" ? "↗" : template.value === "image-text" ? "▤" : "≡")}</span><span><strong class="svelte-17dfpeu">${escape_html(template.label)}</strong><small class="svelte-17dfpeu">${escape_html(template.value === "cards" ? "Configurable grid" : template.value === "carousel" ? "Image slides" : template.value === "cta" ? "Opens enquiries" : "Rich text content")}</small></span><span>+</span></button>`);
    }
    $$renderer2.push(`<!--]--><hr class="svelte-17dfpeu"/><p class="small text-body-secondary mb-0 svelte-17dfpeu"><strong>${escape_html(sections.length)}</strong> sections · <strong>${escape_html(undoStack.length)}</strong> undo step${escape_html(undoStack.length === 1 ? "" : "s")}</p></div></aside> <main class="svelte-17dfpeu"><div class="page-canvas-header svelte-17dfpeu"><div><span class="small text-body-secondary">${escape_html("Draft canvas")}</span><h2 class="svelte-17dfpeu">${escape_html(activePage)}</h2></div><span class="canvas-status svelte-17dfpeu">${escape_html("Session draft")}</span></div>`);
    if (sections.find((item) => item.id === selectedSectionId)) {
      $$renderer2.push("<!--[0-->");
      const selectedSection = sections.find((item) => item.id === selectedSectionId);
      $$renderer2.push(`<div class="card mb-3 p-3"><div class="row g-2 align-items-end"><div class="col-md-5"><label class="form-label" for="selected-section-action-label">Selected section action label</label><input id="selected-section-action-label" class="form-control form-control-sm"${attr("value", selectedSection.actionLabel || "")}/></div><div class="col-md-7">`);
      ActionEditor($$renderer2, {
        label: "Selected section action",
        compact: true,
        value: selectedSection.action || { type: "none" }
      });
      $$renderer2.push(`<!----></div></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="page-canvas svelte-17dfpeu">`);
      if (sections.length === 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="empty-canvas svelte-17dfpeu"><h3 class="svelte-17dfpeu">No sections yet</h3><p class="svelte-17dfpeu">Choose a template to start building this page.</p></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <!--[-->`);
      const each_array_7 = ensure_array_like(sections);
      for (let sectionIndex = 0, $$length = each_array_7.length; sectionIndex < $$length; sectionIndex++) {
        let section = each_array_7[sectionIndex];
        $$renderer2.push(`<div${attr_class(`builder-section section-${section.width} ${selectedSectionId === section.id ? "selected" : ""} ${sectionDropTarget?.index === sectionIndex && sectionDropTarget.position === "before" ? "drop-before" : ""} ${sectionDropTarget?.index === sectionIndex && sectionDropTarget.position === "after" ? "drop-after" : ""}`, "svelte-17dfpeu")}${attr_style(paintStyle(section))} role="button" tabindex="0"${attr("aria-label", `Select ${section.title} section`)} draggable="true"><div class="section-controls svelte-17dfpeu"><div class="svelte-17dfpeu"><span class="drag-handle svelte-17dfpeu" title="Drag to reorder">⠿</span><span class="section-type svelte-17dfpeu">${escape_html(sectionLabel(section.type))}</span></div><div class="d-flex gap-2 align-items-center svelte-17dfpeu"><button class="btn btn-sm btn-outline-danger svelte-17dfpeu" type="button"${attr("disabled", protectedPage, true)}>Remove</button></div></div> <div class="section-fields svelte-17dfpeu"><div class="row g-2 mb-3"><div${attr_class(clsx(section.type === "cards" || section.type === "carousel" || section.type === "accordion" ? "col-md-5" : "col-md-6"))}><label class="form-label svelte-17dfpeu"${attr("for", `title-${section.id}`)}>${escape_html(section.type === "cards" || section.type === "carousel" || section.type === "accordion" ? "Section heading" : "Editor label")}</label><input${attr("id", `title-${section.id}`)} class="form-control svelte-17dfpeu"${attr("value", section.title)}/>`);
        if (section.type !== "cards" && section.type !== "carousel" && section.type !== "accordion") {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="form-text svelte-17dfpeu">Edit the visible heading in the rich text below.</div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div><div${attr_class(clsx(section.type === "cards" || section.type === "carousel" || section.type === "accordion" ? "col-md-4" : "col-md-6"))}><label class="form-label svelte-17dfpeu"${attr("for", `eyebrow-${section.id}`)}>Eyebrow</label><input${attr("id", `eyebrow-${section.id}`)} class="form-control svelte-17dfpeu" placeholder="Optional label above the heading"${attr("value", section.eyebrow || "")}/></div>`);
        if (section.type === "cards") {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="col-md-3"><label class="form-label svelte-17dfpeu"${attr("for", `columns-${section.id}`)}>Card grid</label>`);
          $$renderer2.select(
            {
              id: `columns-${section.id}`,
              class: "form-select",
              value: section.columns
            },
            ($$renderer3) => {
              $$renderer3.option({ value: "1" }, ($$renderer4) => {
                $$renderer4.push(`1 column`);
              });
              $$renderer3.option({ value: "2" }, ($$renderer4) => {
                $$renderer4.push(`2 columns`);
              });
              $$renderer3.option({ value: "3" }, ($$renderer4) => {
                $$renderer4.push(`3 columns`);
              });
              $$renderer3.option({ value: "4" }, ($$renderer4) => {
                $$renderer4.push(`4 columns`);
              });
            }
          );
          $$renderer2.push(`</div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> `);
        if (section.type === "cards" || section.type === "carousel") {
          $$renderer2.push("<!--[0-->");
          BackgroundControls($$renderer2, { value: section, label: "Section background", compact: true });
          $$renderer2.push(`<!---->`);
          if (section.type === "carousel") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<label class="form-check small mb-3 svelte-17dfpeu"><input class="form-check-input svelte-17dfpeu" type="checkbox"${attr("checked", section.autoplay !== false, true)}/> Auto-advance slides</label>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--><div${attr_class("card-list svelte-17dfpeu", void 0, { "carousel-editor": section.type === "carousel" })}${attr_style(`--card-columns:${section.type === "carousel" ? 1 : section.columns || 3}`)}><!--[-->`);
          const each_array_8 = ensure_array_like(section.cards || []);
          for (let cardIndex = 0, $$length2 = each_array_8.length; cardIndex < $$length2; cardIndex++) {
            let card = each_array_8[cardIndex];
            $$renderer2.push(`<div class="sub-card svelte-17dfpeu"${attr_style(paintStyle(card))} role="listitem" draggable="true"><div class="sub-card-toolbar svelte-17dfpeu"><span class="drag-handle svelte-17dfpeu">⠿</span><strong class="svelte-17dfpeu">${escape_html(section.type === "carousel" ? `Slide ${cardIndex + 1}` : `Card ${cardIndex + 1}`)}</strong><button class="btn btn-sm btn-link text-danger svelte-17dfpeu" type="button"${attr("disabled", protectedPage || (section.cards || []).length <= 1, true)}>Remove</button></div><label class="form-label small mb-1 svelte-17dfpeu"${attr("for", `card-title-${card.id}`)}>${escape_html(section.type === "carousel" ? "Slide heading" : "Card heading")}</label><input${attr("id", `card-title-${card.id}`)} class="form-control mb-2 svelte-17dfpeu"${attr("value", card.title)}/>`);
            if (section.showCardImages === true || Boolean((section.cards || []).some((item) => item.image) && section.showCardImages !== false)) {
              $$renderer2.push("<!--[0-->");
              if (card.image) {
                $$renderer2.push("<!--[0-->");
                $$renderer2.push(`<img class="card-image-preview svelte-17dfpeu"${attr("src", card.image)} alt=""/>`);
              } else {
                $$renderer2.push("<!--[-1-->");
              }
              $$renderer2.push(`<!--]--><input class="form-control form-control-sm mb-2 svelte-17dfpeu" aria-label="Card image URL" placeholder="Image URL"${attr("value", card.image || "")}/>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]-->`);
            RichTextEditor($$renderer2, {
              id: `card-${card.id}`,
              rows: 3,
              value: card.content,
              $$slots: {
                "toolbar-end": ($$renderer3) => {
                  BackgroundControls($$renderer3, {
                    slot: "toolbar-end",
                    value: card,
                    label: section.type === "carousel" ? `Slide ${cardIndex + 1} background` : `Card ${cardIndex + 1} background`,
                    compact: true
                  });
                }
              }
            });
            $$renderer2.push(`<!----><input class="form-control form-control-sm mt-2 svelte-17dfpeu" aria-label="Card enquiry button label" placeholder="Optional enquiry button label"${attr("value", card.ctaLabel || "")}/>`);
            if (card.ctaLabel) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<button class="btn btn-sm btn-primary mt-2 svelte-17dfpeu" type="button">${escape_html(card.ctaLabel)}</button>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--></div>`);
          }
          $$renderer2.push(`<!--]--></div><button class="btn btn-sm btn-outline-primary mt-3 svelte-17dfpeu" type="button"${attr("disabled", protectedPage, true)}>+ Add ${escape_html(section.type === "carousel" ? "slide" : "card")}</button>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          RichTextEditor($$renderer2, {
            id: `section-${section.id}`,
            rows: 5,
            value: section.content,
            $$slots: {
              "toolbar-end": ($$renderer3) => {
                BackgroundControls($$renderer3, {
                  slot: "toolbar-end",
                  value: section,
                  label: "Section background",
                  compact: true
                });
              }
            }
          });
          $$renderer2.push(`<!---->`);
          if (section.type === "image-text") {
            $$renderer2.push("<!--[0-->");
            if (section.showImage === true || Boolean(section.image && section.showImage !== false)) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<div class="mt-3"><label class="form-label svelte-17dfpeu"${attr("for", `image-${section.id}`)}>Section image URL</label><input${attr("id", `image-${section.id}`)} class="form-control svelte-17dfpeu" placeholder="Image URL"${attr("value", section.image || "")}/></div>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]-->`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]-->`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></main> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<aside class="inspector-panel card svelte-17dfpeu">`);
      if (sections.find((item) => item.id === selectedSectionId)) {
        $$renderer2.push("<!--[0-->");
        const appearanceSection = sections.find((item) => item.id === selectedSectionId);
        $$renderer2.push(`<div class="card-body"><p class="eyebrow mb-1 svelte-17dfpeu">Section inspector</p> <h2 class="h6 mb-2">Appearance and behaviour</h2> <p class="small text-body-secondary mb-3">These settings affect only the selected section. Options appear when they can change what visitors see.</p> `);
        SectionAppearanceControls($$renderer2, { value: appearanceSection });
        $$renderer2.push(`<!----></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="card-body text-body-secondary small">Select a section on the canvas to adjust its appearance.</div>`);
      }
      $$renderer2.push(`<!--]--></aside>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <details class="cms-events card svelte-17dfpeu"><summary class="svelte-17dfpeu">CMS builder messages (${escape_html(eventLog.length)})</summary><div class="cms-events-body svelte-17dfpeu">`);
    if (eventLog.length) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_10 = ensure_array_like(eventLog);
      for (let $$index_10 = 0, $$length = each_array_10.length; $$index_10 < $$length; $$index_10++) {
        let event = each_array_10[$$index_10];
        $$renderer2.push(`<div class="svelte-17dfpeu"><time class="svelte-17dfpeu">${escape_html(event.time)}</time><span>${escape_html(event.message)}</span></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span class="text-body-secondary">Builder events will appear here.</span>`);
    }
    $$renderer2.push(`<!--]--></div></details></div>`);
  });
}
export {
  _page as default
};
