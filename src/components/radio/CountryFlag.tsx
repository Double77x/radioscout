import { cn } from "@/lib/utils";
import deUrl from "flag-icons/flags/4x3/de.svg?url";
import frUrl from "flag-icons/flags/4x3/fr.svg?url";
import gbUrl from "flag-icons/flags/4x3/gb.svg?url";
import esUrl from "flag-icons/flags/4x3/es.svg?url";
import itUrl from "flag-icons/flags/4x3/it.svg?url";
import nlUrl from "flag-icons/flags/4x3/nl.svg?url";
import plUrl from "flag-icons/flags/4x3/pl.svg?url";
import uaUrl from "flag-icons/flags/4x3/ua.svg?url";
import ptUrl from "flag-icons/flags/4x3/pt.svg?url";
import seUrl from "flag-icons/flags/4x3/se.svg?url";
import noUrl from "flag-icons/flags/4x3/no.svg?url";
import fiUrl from "flag-icons/flags/4x3/fi.svg?url";
import dkUrl from "flag-icons/flags/4x3/dk.svg?url";
import ieUrl from "flag-icons/flags/4x3/ie.svg?url";
import beUrl from "flag-icons/flags/4x3/be.svg?url";
import chUrl from "flag-icons/flags/4x3/ch.svg?url";
import atUrl from "flag-icons/flags/4x3/at.svg?url";
import czUrl from "flag-icons/flags/4x3/cz.svg?url";
import skUrl from "flag-icons/flags/4x3/sk.svg?url";
import huUrl from "flag-icons/flags/4x3/hu.svg?url";
import roUrl from "flag-icons/flags/4x3/ro.svg?url";
import grUrl from "flag-icons/flags/4x3/gr.svg?url";
import trUrl from "flag-icons/flags/4x3/tr.svg?url";
import hrUrl from "flag-icons/flags/4x3/hr.svg?url";
import rsUrl from "flag-icons/flags/4x3/rs.svg?url";
import bgUrl from "flag-icons/flags/4x3/bg.svg?url";
import ltUrl from "flag-icons/flags/4x3/lt.svg?url";
import lvUrl from "flag-icons/flags/4x3/lv.svg?url";
import eeUrl from "flag-icons/flags/4x3/ee.svg?url";
import isUrl from "flag-icons/flags/4x3/is.svg?url";
import luUrl from "flag-icons/flags/4x3/lu.svg?url";
import mtUrl from "flag-icons/flags/4x3/mt.svg?url";
import cyUrl from "flag-icons/flags/4x3/cy.svg?url";
import usUrl from "flag-icons/flags/4x3/us.svg?url";
import caUrl from "flag-icons/flags/4x3/ca.svg?url";
import mxUrl from "flag-icons/flags/4x3/mx.svg?url";
import brUrl from "flag-icons/flags/4x3/br.svg?url";
import arUrl from "flag-icons/flags/4x3/ar.svg?url";
import coUrl from "flag-icons/flags/4x3/co.svg?url";
import clUrl from "flag-icons/flags/4x3/cl.svg?url";
import peUrl from "flag-icons/flags/4x3/pe.svg?url";
import veUrl from "flag-icons/flags/4x3/ve.svg?url";
import ecUrl from "flag-icons/flags/4x3/ec.svg?url";
import uyUrl from "flag-icons/flags/4x3/uy.svg?url";
import pyUrl from "flag-icons/flags/4x3/py.svg?url";
import boUrl from "flag-icons/flags/4x3/bo.svg?url";
import crUrl from "flag-icons/flags/4x3/cr.svg?url";
import auUrl from "flag-icons/flags/4x3/au.svg?url";
import inUrl from "flag-icons/flags/4x3/in.svg?url";
import jpUrl from "flag-icons/flags/4x3/jp.svg?url";
import krUrl from "flag-icons/flags/4x3/kr.svg?url";
import cnUrl from "flag-icons/flags/4x3/cn.svg?url";
import idUrl from "flag-icons/flags/4x3/id.svg?url";
import myUrl from "flag-icons/flags/4x3/my.svg?url";
import phUrl from "flag-icons/flags/4x3/ph.svg?url";
import thUrl from "flag-icons/flags/4x3/th.svg?url";
import vnUrl from "flag-icons/flags/4x3/vn.svg?url";
import sgUrl from "flag-icons/flags/4x3/sg.svg?url";
import nzUrl from "flag-icons/flags/4x3/nz.svg?url";
import zaUrl from "flag-icons/flags/4x3/za.svg?url";
import ngUrl from "flag-icons/flags/4x3/ng.svg?url";
import egUrl from "flag-icons/flags/4x3/eg.svg?url";
import ilUrl from "flag-icons/flags/4x3/il.svg?url";
import maUrl from "flag-icons/flags/4x3/ma.svg?url";
import dzUrl from "flag-icons/flags/4x3/dz.svg?url";
import ruUrl from "flag-icons/flags/4x3/ru.svg?url";

interface CountryFlagProps {
  /** ISO 3166-1 alpha-2, any case. */
  code: string;
  /** Full country name — accessible label; shown when no flag is bundled. */
  name?: string;
  className?: string;
}

/**
 * Country flag as a plain image. Only the curated set below ships — each
 * file is fetched on demand and cached, and codes outside the set fall
 * back to a compact code pill (never the full country name).
 */
const FLAG_URLS: Record<string, string> = {
  de: deUrl,
  fr: frUrl,
  gb: gbUrl,
  es: esUrl,
  it: itUrl,
  nl: nlUrl,
  pl: plUrl,
  ua: uaUrl,
  pt: ptUrl,
  se: seUrl,
  no: noUrl,
  fi: fiUrl,
  dk: dkUrl,
  ie: ieUrl,
  be: beUrl,
  ch: chUrl,
  at: atUrl,
  cz: czUrl,
  sk: skUrl,
  hu: huUrl,
  ro: roUrl,
  gr: grUrl,
  tr: trUrl,
  hr: hrUrl,
  rs: rsUrl,
  bg: bgUrl,
  lt: ltUrl,
  lv: lvUrl,
  ee: eeUrl,
  is: isUrl,
  lu: luUrl,
  mt: mtUrl,
  cy: cyUrl,
  us: usUrl,
  ca: caUrl,
  mx: mxUrl,
  br: brUrl,
  ar: arUrl,
  co: coUrl,
  cl: clUrl,
  pe: peUrl,
  ve: veUrl,
  ec: ecUrl,
  uy: uyUrl,
  py: pyUrl,
  bo: boUrl,
  cr: crUrl,
  au: auUrl,
  in: inUrl,
  jp: jpUrl,
  kr: krUrl,
  cn: cnUrl,
  id: idUrl,
  my: myUrl,
  ph: phUrl,
  th: thUrl,
  vn: vnUrl,
  sg: sgUrl,
  nz: nzUrl,
  za: zaUrl,
  ng: ngUrl,
  eg: egUrl,
  il: ilUrl,
  ma: maUrl,
  dz: dzUrl,
  ru: ruUrl,
};

export function CountryFlag({ code, name, className }: CountryFlagProps) {
  const iso = code.trim().toLowerCase();
  const label = name || iso.toUpperCase() || "Unknown country";
  const src = /^[a-z]{2}$/.test(iso) ? FLAG_URLS[iso] : undefined;
  if (!src) {
    if (!name && iso === "") return null;
    return (
      <span
        title={label}
        className={cn(
          "inline-block shrink-0 rounded-sm bg-muted px-1 py-px text-xs font-bold tracking-wide text-muted-foreground uppercase",
          className,
        )}>
        {iso.toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={label}
      title={label}
      loading='lazy'
      decoding='async'
      draggable={false}
      className={cn("inline-block h-[0.9em] w-auto shrink-0 rounded-[2px]", className)}
    />
  );
}
