"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PhotoMetadata } from "@/components/photo-metadata";
import type { MediaAnalysisResponse, PublicAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PhotoViewerProps {
  asset: PublicAsset;
  fullsizeUrl: string;
  navigation: PhotoViewerNavigation;
}

export interface PhotoViewerNavigation {
  albumTitle: string | null;
  backHref: string;
  next: PhotoViewerNavItem | null;
  positionLabel: string | null;
  previous: PhotoViewerNavItem | null;
  stripItems: PhotoViewerStripItem[];
}

interface PhotoViewerNavItem {
  href: string;
  title: string;
}

interface PhotoViewerStripItem {
  active: boolean;
  href: string;
  id: string;
  thumbUrl: string;
  title: string;
}

interface ToolMenuState {
  x: number;
  y: number;
}

interface Point {
  x: number;
  y: number;
}

interface ViewState {
  offset: Point;
  zoom: number;
}

type HistogramData = MediaAnalysisResponse["bins"];

interface AnalysisBuffer {
  data: Uint8ClampedArray;
  height: number;
  width: number;
}

interface PointerState {
  mode: "panCandidate" | "panning";
  originOffset: Point;
  pointerId: number;
  startX: number;
  startY: number;
}

interface MinimapDragState {
  pointerId: number;
}

interface MinimapViewport {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface PixelProbe {
  blueLevel: number;
  blueShare: number;
  brightness: number;
  greenLevel: number;
  greenShare: number;
  hex: string;
  imageX: number;
  imageY: number;
  redLevel: number;
  redShare: number;
  rgb: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.22;
const PAN_THRESHOLD_PX = 6;
const INSPECTOR_OPEN_STORAGE_KEY = "photo-viewer:inspector-open";
const INSPECTOR_TAB_STORAGE_KEY = "photo-viewer:inspector-tab";
const FILMSTRIP_OPEN_STORAGE_KEY = "photo-viewer:filmstrip-open";

export function PhotoViewer({
  asset,
  fullsizeUrl,
  navigation,
}: PhotoViewerProps) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointerStateRef = useRef<PointerState | null>(null);
  const draggedDuringPointerRef = useRef(false);
  const minimapDragRef = useRef<MinimapDragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingViewRef = useRef<ViewState | null>(null);
  const histogramRequestRef = useRef<AbortController | null>(null);
  const probeReadyRef = useRef(false);
  const probeBuildPendingRef = useRef(false);
  const analysisRef = useRef<AnalysisBuffer | null>(null);
  const probeFrameRef = useRef<number | null>(null);
  const probePointRef = useRef<Point | null>(null);
  const lastProbeKeyRef = useRef("");
  const viewRef = useRef<ViewState>({
    zoom: MIN_ZOOM,
    offset: { x: 0, y: 0 },
  });

  const [view, setView] = useState<ViewState>(viewRef.current);
  const [naturalSize, setNaturalSize] = useState({ height: 0, width: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [toolMenu, setToolMenu] = useState<ToolMenuState | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"metadata" | "histogram">(
    "metadata",
  );
  const [histogram, setHistogram] = useState<HistogramData | null>(null);
  const [histogramPending, setHistogramPending] = useState(false);
  const [histogramError, setHistogramError] = useState<string | null>(null);
  const [pixelProbe, setPixelProbe] = useState<PixelProbe | null>(null);
  const [isMinimapDragging, setIsMinimapDragging] = useState(false);
  const [filmstripOpen, setFilmstripOpen] = useState(false);

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function clearPixelProbe() {
    lastProbeKeyRef.current = "";
    setPixelProbe(null);
  }

  function stopPointerInteraction() {
    pointerStateRef.current = null;
    setIsDragging(false);
  }

  function applyView(next: ViewState, immediate = false) {
    viewRef.current = next;

    if (immediate) {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      pendingViewRef.current = null;
      setView(next);
      return;
    }

    pendingViewRef.current = next;

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const pending = pendingViewRef.current;

      if (!pending) {
        return;
      }

      pendingViewRef.current = null;
      setView(pending);
    });
  }

  function getFitFrame() {
    const stage = stageRef.current;

    if (!stage || !naturalSize.width || !naturalSize.height) {
      return null;
    }

    const rect = stage.getBoundingClientRect();
    const imageRatio = naturalSize.width / naturalSize.height;
    const stageRatio = rect.width / rect.height;

    const baseWidth =
      imageRatio > stageRatio ? rect.width : rect.height * imageRatio;
    const baseHeight =
      imageRatio > stageRatio ? rect.width / imageRatio : rect.height;

    return { baseHeight, baseWidth, rect };
  }

  function getMinimapViewport(currentView: ViewState): MinimapViewport | null {
    const frame = getFitFrame();

    if (!frame || currentView.zoom <= MIN_ZOOM) {
      return null;
    }

    const minX = -frame.baseWidth / 2;
    const maxX = frame.baseWidth / 2;
    const minY = -frame.baseHeight / 2;
    const maxY = frame.baseHeight / 2;
    const halfStageWidth = frame.rect.width / 2;
    const halfStageHeight = frame.rect.height / 2;
    const left = clamp(
      (-halfStageWidth - currentView.offset.x) / currentView.zoom,
      minX,
      maxX,
    );
    const right = clamp(
      (halfStageWidth - currentView.offset.x) / currentView.zoom,
      minX,
      maxX,
    );
    const top = clamp(
      (-halfStageHeight - currentView.offset.y) / currentView.zoom,
      minY,
      maxY,
    );
    const bottom = clamp(
      (halfStageHeight - currentView.offset.y) / currentView.zoom,
      minY,
      maxY,
    );

    const leftPercent = ((left - minX) / frame.baseWidth) * 100;
    const rightPercent = ((right - minX) / frame.baseWidth) * 100;
    const topPercent = ((top - minY) / frame.baseHeight) * 100;
    const bottomPercent = ((bottom - minY) / frame.baseHeight) * 100;

    return {
      height: Math.max(4, bottomPercent - topPercent),
      left: leftPercent,
      top: topPercent,
      width: Math.max(4, rightPercent - leftPercent),
    };
  }

  function getZoomOneHundred() {
    const frame = getFitFrame();

    if (!frame) {
      return 2;
    }

    const widthScale = naturalSize.width / frame.baseWidth;
    const heightScale = naturalSize.height / frame.baseHeight;
    return clamp(Math.max(widthScale, heightScale, MIN_ZOOM), MIN_ZOOM, MAX_ZOOM);
  }

  function getPanBounds(nextZoom: number) {
    const frame = getFitFrame();

    if (!frame) {
      return { x: 0, y: 0 };
    }

    return {
      x: Math.max(0, ((frame.baseWidth * nextZoom) - frame.baseWidth) / 2),
      y: Math.max(0, ((frame.baseHeight * nextZoom) - frame.baseHeight) / 2),
    };
  }

  function clampOffset(nextZoom: number, candidate: Point) {
    const bounds = getPanBounds(nextZoom);

    return {
      x: clamp(candidate.x, -bounds.x, bounds.x),
      y: clamp(candidate.y, -bounds.y, bounds.y),
    };
  }

  function resetView() {
    stopPointerInteraction();
    applyView(
      {
        zoom: MIN_ZOOM,
        offset: { x: 0, y: 0 },
      },
      true,
    );
  }

  function applyZoom(nextZoom: number, focus: Point = { x: 0, y: 0 }) {
    const current = viewRef.current;
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);

    if (clampedZoom === MIN_ZOOM) {
      resetView();
      return;
    }

    const scaleRatio = clampedZoom / current.zoom;
    applyView({
      zoom: clampedZoom,
      offset: clampOffset(clampedZoom, {
        x: focus.x - scaleRatio * (focus.x - current.offset.x),
        y: focus.y - scaleRatio * (focus.y - current.offset.y),
      }),
    });
  }

  function getFocusPoint(clientX: number, clientY: number) {
    const frame = getFitFrame();

    if (!frame) {
      return { x: 0, y: 0 };
    }

    return {
      x: clientX - frame.rect.left - frame.rect.width / 2,
      y: clientY - frame.rect.top - frame.rect.height / 2,
    };
  }

  function openToolMenu(clientX: number, clientY: number) {
    const menuWidth = 292;
    const menuHeight = 270;
    const x = clamp(clientX, 8, window.innerWidth - menuWidth - 8);
    const y = clamp(clientY, 8, window.innerHeight - menuHeight - 8);
    setToolMenu({ x, y });
  }

  function closeToolMenu() {
    setToolMenu(null);
  }

  function toggleZoomOneHundred(focus: Point) {
    const currentZoom = viewRef.current.zoom;
    const zoom100 = getZoomOneHundred();

    if (Math.abs(currentZoom - zoom100) < 0.04) {
      resetView();
      return;
    }

    applyZoom(zoom100, focus);
  }

  function releasePointerCaptureSafe(
    target: EventTarget & HTMLDivElement,
    pointerId: number,
  ) {
    try {
      if (target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore release errors when pointer capture was already dropped.
    }
  }

  function updateViewFromMinimap(clientX: number, clientY: number) {
    const minimap = minimapRef.current;
    const frame = getFitFrame();
    const currentZoom = viewRef.current.zoom;

    if (!minimap || !frame || currentZoom <= MIN_ZOOM) {
      return;
    }

    const rect = minimap.getBoundingClientRect();
    const normalizedX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const normalizedY = clamp((clientY - rect.top) / rect.height, 0, 1);
    const imageCenterX = (normalizedX - 0.5) * frame.baseWidth;
    const imageCenterY = (normalizedY - 0.5) * frame.baseHeight;

    applyView({
      zoom: currentZoom,
      offset: clampOffset(currentZoom, {
        x: -imageCenterX * currentZoom,
        y: -imageCenterY * currentZoom,
      }),
    });
  }

  function handlePersonSearch() {
    if (!asset.people.length) {
      closeToolMenu();
      return;
    }

    if (asset.people.length === 1) {
      closeToolMenu();
      router.push(asset.people[0]!.href);
      return;
    }

    const choice = window.prompt(
      `Open which person page?\n${asset.people
        .map((person, index) => `${index + 1}. ${person.displayName}`)
        .join("\n")}`,
      asset.people[0]!.displayName,
    );
    const cleaned = choice?.trim();

    if (!cleaned) {
      closeToolMenu();
      return;
    }

    const selected =
      asset.people.find(
        (person) => person.displayName.toLowerCase() === cleaned.toLowerCase(),
      ) ??
      asset.people[Number(cleaned) - 1] ??
      asset.people[0];

    closeToolMenu();
    router.push(selected.href);
  }

  function handleDownloadOriginal() {
    if (!asset.downloadUrl) {
      closeToolMenu();
      return;
    }

    window.location.href = asset.downloadUrl;
    closeToolMenu();
  }

  function probePixel(clientX: number, clientY: number) {
    const frame = getFitFrame();
    const analysis = analysisRef.current;
    const currentView = viewRef.current;

    if (!frame || !analysis || !naturalSize.width || !naturalSize.height) {
      if (lastProbeKeyRef.current) {
        clearPixelProbe();
      }
      return;
    }

    const stageX = clientX - frame.rect.left - frame.rect.width / 2;
    const stageY = clientY - frame.rect.top - frame.rect.height / 2;
    const imageX = (stageX - currentView.offset.x) / currentView.zoom;
    const imageY = (stageY - currentView.offset.y) / currentView.zoom;
    const insideImage =
      Math.abs(imageX) <= frame.baseWidth / 2 &&
      Math.abs(imageY) <= frame.baseHeight / 2;

    if (!insideImage) {
      if (lastProbeKeyRef.current) {
        clearPixelProbe();
      }
      return;
    }

    const normalizedX = clamp((imageX + frame.baseWidth / 2) / frame.baseWidth, 0, 1);
    const normalizedY = clamp((imageY + frame.baseHeight / 2) / frame.baseHeight, 0, 1);
    const sampleX = Math.min(
      analysis.width - 1,
      Math.max(0, Math.floor(normalizedX * analysis.width)),
    );
    const sampleY = Math.min(
      analysis.height - 1,
      Math.max(0, Math.floor(normalizedY * analysis.height)),
    );
    const pixelOffset = (sampleY * analysis.width + sampleX) * 4;
    const red = analysis.data[pixelOffset] ?? 0;
    const green = analysis.data[pixelOffset + 1] ?? 0;
    const blue = analysis.data[pixelOffset + 2] ?? 0;
    const key = `${sampleX}:${sampleY}:${red}:${green}:${blue}`;

    if (key === lastProbeKeyRef.current) {
      return;
    }

    lastProbeKeyRef.current = key;
    const total = Math.max(red + green + blue, 1);
    const brightness = ((0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255) * 100;
    const naturalX = Math.round(normalizedX * Math.max(0, naturalSize.width - 1));
    const naturalY = Math.round(normalizedY * Math.max(0, naturalSize.height - 1));
    const hex = `#${red.toString(16).padStart(2, "0")}${green
      .toString(16)
      .padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`.toUpperCase();

    setPixelProbe({
      blueLevel: (blue / 255) * 100,
      blueShare: (blue / total) * 100,
      brightness,
      greenLevel: (green / 255) * 100,
      greenShare: (green / total) * 100,
      hex,
      imageX: naturalX,
      imageY: naturalY,
      redLevel: (red / 255) * 100,
      redShare: (red / total) * 100,
      rgb: `${red}, ${green}, ${blue}`,
    });
  }

  function queuePixelProbe(clientX: number, clientY: number) {
    if (!inspectorOpen || inspectorTab !== "histogram" || !analysisRef.current) {
      return;
    }

    probePointRef.current = { x: clientX, y: clientY };

    if (probeFrameRef.current !== null) {
      return;
    }

    probeFrameRef.current = window.requestAnimationFrame(() => {
      probeFrameRef.current = null;
      const pendingPoint = probePointRef.current;
      probePointRef.current = null;

      if (!pendingPoint) {
        return;
      }

      probePixel(pendingPoint.x, pendingPoint.y);
    });
  }

  function prepareProbeBuffer() {
    const image = imageRef.current;

    if (
      !image ||
      !image.naturalWidth ||
      !image.naturalHeight ||
      probeReadyRef.current ||
      probeBuildPendingRef.current
    ) {
      return;
    }

    probeBuildPendingRef.current = true;

    const run = () => {
      try {
        const maxSide = 900;
        const scale = Math.min(
          1,
          maxSide / Math.max(image.naturalWidth, image.naturalHeight),
        );
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          throw new Error("Could not create probe context.");
        }

        context.drawImage(image, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);

        analysisRef.current = {
          data: imageData.data.slice(),
          height,
          width,
        };
        probeReadyRef.current = true;
      } catch {
        analysisRef.current = null;
        probeReadyRef.current = false;
        clearPixelProbe();
      } finally {
        probeBuildPendingRef.current = false;
      }
    };

    const hasIdleCallback = "requestIdleCallback" in window;

    if (hasIdleCallback) {
      (window as Window & {
        requestIdleCallback: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions,
        ) => number;
      }).requestIdleCallback(run, { timeout: 300 });
      return;
    }

    setTimeout(run, 0);
  }

  async function fetchHistogramFromServer() {
    const request = new AbortController();

    histogramRequestRef.current?.abort();
    histogramRequestRef.current = request;
    setHistogramPending(true);
    setHistogramError(null);

    try {
      const response = await fetch(`/api/media/${asset.id}/analysis`, {
        cache: "no-store",
        signal: request.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          errorBody || `Histogram request failed with status ${response.status}.`,
        );
      }

      const payload = (await response.json()) as MediaAnalysisResponse;
      setHistogram(payload.bins);
    } catch (error) {
      if (request.signal.aborted) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Histogram is unavailable for this image.";
      setHistogramError(message);
    } finally {
      if (histogramRequestRef.current === request) {
        histogramRequestRef.current = null;
      }
      setHistogramPending(false);
    }
  }

  useEffect(() => {
    document.documentElement.classList.add("photo-route");
    document.body.classList.add("photo-route");

    return () => {
      document.documentElement.classList.remove("photo-route");
      document.body.classList.remove("photo-route");
    };
  }, []);

  useEffect(() => {
    try {
      const savedOpen = window.sessionStorage.getItem(INSPECTOR_OPEN_STORAGE_KEY);
      if (savedOpen === "1" || savedOpen === "0") {
        setInspectorOpen(savedOpen === "1");
      }

      const savedTab = window.sessionStorage.getItem(INSPECTOR_TAB_STORAGE_KEY);
      if (savedTab === "metadata" || savedTab === "histogram") {
        setInspectorTab(savedTab);
      }

      const savedFilmstrip = window.sessionStorage.getItem(
        FILMSTRIP_OPEN_STORAGE_KEY,
      );
      if (savedFilmstrip === "1" || savedFilmstrip === "0") {
        setFilmstripOpen(savedFilmstrip === "1");
      }
    } catch {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        INSPECTOR_OPEN_STORAGE_KEY,
        inspectorOpen ? "1" : "0",
      );
      window.sessionStorage.setItem(INSPECTOR_TAB_STORAGE_KEY, inspectorTab);
      window.sessionStorage.setItem(
        FILMSTRIP_OPEN_STORAGE_KEY,
        filmstripOpen ? "1" : "0",
      );
    } catch {
      // Ignore storage failures.
    }
  }, [filmstripOpen, inspectorOpen, inspectorTab]);

  useEffect(() => {
    resetView();
    histogramRequestRef.current?.abort();
    histogramRequestRef.current = null;
    analysisRef.current = null;
    probeReadyRef.current = false;
    probeBuildPendingRef.current = false;
    setHistogram(null);
    setHistogramError(null);
    setHistogramPending(false);
    setPixelProbe(null);
    lastProbeKeyRef.current = "";
    probePointRef.current = null;
    if (probeFrameRef.current !== null) {
      window.cancelAnimationFrame(probeFrameRef.current);
      probeFrameRef.current = null;
    }
    draggedDuringPointerRef.current = false;
    pointerStateRef.current = null;
    minimapDragRef.current = null;
    setIsMinimapDragging(false);
    setToolMenu(null);
  }, [asset.id]);

  useEffect(() => {
    if (!toolMenu) {
      return;
    }

    function handleWindowPointerDown() {
      closeToolMenu();
    }

    window.addEventListener("pointerdown", handleWindowPointerDown);
    return () => window.removeEventListener("pointerdown", handleWindowPointerDown);
  }, [toolMenu]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeToolMenu();
        setInspectorOpen(false);
        resetView();
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        resetView();
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        applyZoom(viewRef.current.zoom + ZOOM_STEP);
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        applyZoom(viewRef.current.zoom - ZOOM_STEP);
        return;
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        setInspectorOpen((current) => !current);
        return;
      }

      if (event.key === "ArrowLeft" && navigation.previous) {
        event.preventDefault();
        router.push(navigation.previous.href);
        return;
      }

      if (event.key === "ArrowRight" && navigation.next) {
        event.preventDefault();
        router.push(navigation.next.href);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [navigation.next, navigation.previous, router]);

  useEffect(() => {
    if (
      !inspectorOpen ||
      inspectorTab !== "histogram" ||
      histogram ||
      histogramPending ||
      histogramError
    ) {
      return;
    }

    void fetchHistogramFromServer();
  }, [
    asset.id,
    histogram,
    histogramError,
    histogramPending,
    inspectorOpen,
    inspectorTab,
  ]);

  useEffect(() => {
    if (
      !inspectorOpen ||
      inspectorTab !== "histogram" ||
      !naturalSize.width ||
      !naturalSize.height
    ) {
      return;
    }

    prepareProbeBuffer();
  }, [
    asset.id,
    inspectorOpen,
    inspectorTab,
    naturalSize.height,
    naturalSize.width,
  ]);

  useEffect(() => {
    if (inspectorOpen && inspectorTab === "histogram") {
      return;
    }

    if (probeFrameRef.current !== null) {
      window.cancelAnimationFrame(probeFrameRef.current);
      probeFrameRef.current = null;
    }

    probePointRef.current = null;
    clearPixelProbe();
  }, [inspectorOpen, inspectorTab]);

  useEffect(() => {
    return () => {
      histogramRequestRef.current?.abort();

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      if (probeFrameRef.current !== null) {
        window.cancelAnimationFrame(probeFrameRef.current);
      }
    };
  }, []);

  const isZoomedIn = view.zoom > MIN_ZOOM + 0.001;
  const hasFilmstrip = navigation.stripItems.length > 0;
  const minimapViewport = getMinimapViewport(view);
  const minimapAspectRatio =
    naturalSize.width && naturalSize.height
      ? naturalSize.width / naturalSize.height
      : 16 / 10;
  const imageTransitionEnabled = !isDragging && !isMinimapDragging;

  return (
    <>
      <div
        data-photo-route="true"
        className="relative h-[100dvh] w-full overflow-hidden bg-black text-white"
      >
        <div
          ref={stageRef}
          className={cn(
            "relative h-full w-full overflow-hidden bg-black transition-[padding] duration-300 ease-out",
            inspectorOpen && "md:pr-[22.5rem]",
            isZoomedIn && !isDragging && "cursor-grab",
            isZoomedIn && isDragging && "cursor-grabbing",
            !isZoomedIn && "cursor-default",
          )}
          onContextMenu={(event) => {
            event.preventDefault();
            openToolMenu(event.clientX, event.clientY);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();

            if (draggedDuringPointerRef.current) {
              draggedDuringPointerRef.current = false;
              return;
            }

            toggleZoomOneHundred(getFocusPoint(event.clientX, event.clientY));
          }}
          onWheel={(event) => {
            event.preventDefault();
            applyZoom(
              viewRef.current.zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP),
              getFocusPoint(event.clientX, event.clientY),
            );
          }}
          onPointerDown={(event) => {
            closeToolMenu();

            if (event.button !== 0) {
              return;
            }

            draggedDuringPointerRef.current = false;
            setIsDragging(false);

            if (viewRef.current.zoom <= MIN_ZOOM + 0.001) {
              return;
            }

            pointerStateRef.current = {
              mode: "panCandidate",
              originOffset: viewRef.current.offset,
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
            };

            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const pointerState = pointerStateRef.current;

            if (pointerState && pointerState.pointerId === event.pointerId) {
              const deltaX = event.clientX - pointerState.startX;
              const deltaY = event.clientY - pointerState.startY;

              if (
                pointerState.mode === "panCandidate" &&
                Math.hypot(deltaX, deltaY) > PAN_THRESHOLD_PX
              ) {
                if (viewRef.current.zoom > MIN_ZOOM + 0.001) {
                  pointerState.mode = "panning";
                  pointerState.originOffset = viewRef.current.offset;
                  pointerState.startX = event.clientX;
                  pointerState.startY = event.clientY;
                  setIsDragging(true);
                } else {
                  pointerStateRef.current = null;
                  releasePointerCaptureSafe(event.currentTarget, event.pointerId);
                }
              }

              if (pointerState.mode === "panning") {
                const panX = event.clientX - pointerState.startX;
                const panY = event.clientY - pointerState.startY;
                const currentZoom = viewRef.current.zoom;

                applyView({
                  zoom: currentZoom,
                  offset: clampOffset(currentZoom, {
                    x: pointerState.originOffset.x + panX,
                    y: pointerState.originOffset.y + panY,
                  }),
                });
              }
            }

            queuePixelProbe(event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            const pointerState = pointerStateRef.current;
            if (!pointerState || pointerState.pointerId !== event.pointerId) {
              return;
            }

            draggedDuringPointerRef.current = pointerState.mode === "panning";
            stopPointerInteraction();
            releasePointerCaptureSafe(event.currentTarget, event.pointerId);
          }}
          onPointerCancel={(event) => {
            const pointerState = pointerStateRef.current;
            if (!pointerState || pointerState.pointerId !== event.pointerId) {
              return;
            }

            draggedDuringPointerRef.current = false;
            stopPointerInteraction();
            releasePointerCaptureSafe(event.currentTarget, event.pointerId);
          }}
          onPointerLeave={() => {
            clearPixelProbe();
          }}
          style={{ touchAction: isZoomedIn ? "none" : "pan-y" }}
        >
          <img
            ref={imageRef}
            src={fullsizeUrl}
            alt={asset.title}
            loading="eager"
            decoding="async"
            draggable={false}
            className="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain"
            style={{
              transform: `translate3d(${view.offset.x}px, ${view.offset.y}px, 0) scale(${view.zoom})`,
              transformOrigin: "center center",
              transition: imageTransitionEnabled
                ? "transform 190ms cubic-bezier(0.22, 1, 0.36, 1)"
                : "none",
              willChange: "transform",
            }}
            onLoad={(event) => {
              setNaturalSize({
                height: event.currentTarget.naturalHeight,
                width: event.currentTarget.naturalWidth,
              });
            }}
          />

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.52),transparent_12%,transparent_78%,rgba(0,0,0,0.65))]" />

          <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2 md:left-6 md:top-6">
            <IconLink href={navigation.backHref} label="Back to gallery">
              Back
            </IconLink>
            <IconButton
              label={inspectorOpen ? "Hide info" : "Show info"}
              onClick={() => setInspectorOpen((current) => !current)}
              active={inspectorOpen}
            >
              Info
            </IconButton>
            <IconButton
              label="Zoom out"
              onClick={() => applyZoom(view.zoom - ZOOM_STEP)}
              disabled={view.zoom <= MIN_ZOOM}
            >
              -
            </IconButton>
            <IconButton
              label="Reset zoom"
              onClick={resetView}
              disabled={view.zoom === MIN_ZOOM && view.offset.x === 0 && view.offset.y === 0}
            >
              Fit
            </IconButton>
            <IconButton
              label="Zoom in"
              onClick={() => applyZoom(view.zoom + ZOOM_STEP)}
              disabled={view.zoom >= MAX_ZOOM}
            >
              +
            </IconButton>
            {asset.downloadUrl ? (
              <IconLink href={asset.downloadUrl} label="Download original" external>
                Save
              </IconLink>
            ) : null}
          </div>

          {isZoomedIn && minimapViewport ? (
            <div className="absolute left-4 top-[7.2rem] z-20 w-44 rounded-xl border border-white/20 bg-black/70 p-2 shadow-[0_18px_45px_rgba(0,0,0,0.45)] md:left-6">
              <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-white/55">
                Navigator
              </p>
              <div
                ref={minimapRef}
                className={cn(
                  "relative w-full overflow-hidden rounded-md border border-white/15 bg-black/75",
                  isMinimapDragging ? "cursor-grabbing" : "cursor-grab",
                )}
                style={{ aspectRatio: minimapAspectRatio }}
                onPointerDown={(event) => {
                  event.stopPropagation();

                  if (event.button !== 0) {
                    return;
                  }

                  minimapDragRef.current = { pointerId: event.pointerId };
                  setIsMinimapDragging(true);
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateViewFromMinimap(event.clientX, event.clientY);
                }}
                onPointerMove={(event) => {
                  const minimapDrag = minimapDragRef.current;

                  if (!minimapDrag || minimapDrag.pointerId !== event.pointerId) {
                    return;
                  }

                  updateViewFromMinimap(event.clientX, event.clientY);
                }}
                onPointerUp={(event) => {
                  const minimapDrag = minimapDragRef.current;

                  if (!minimapDrag || minimapDrag.pointerId !== event.pointerId) {
                    return;
                  }

                  minimapDragRef.current = null;
                  setIsMinimapDragging(false);
                  releasePointerCaptureSafe(event.currentTarget, event.pointerId);
                }}
                onPointerCancel={(event) => {
                  const minimapDrag = minimapDragRef.current;

                  if (!minimapDrag || minimapDrag.pointerId !== event.pointerId) {
                    return;
                  }

                  minimapDragRef.current = null;
                  setIsMinimapDragging(false);
                  releasePointerCaptureSafe(event.currentTarget, event.pointerId);
                }}
              >
                <img
                  src={asset.previewUrl}
                  alt={`${asset.title} minimap`}
                  draggable={false}
                  className="h-full w-full select-none object-cover opacity-85"
                />
                <div className="pointer-events-none absolute inset-0 bg-black/25" />
                <div
                  className="pointer-events-none absolute rounded-[2px] border border-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
                  style={{
                    height: `${minimapViewport.height}%`,
                    left: `${minimapViewport.left}%`,
                    top: `${minimapViewport.top}%`,
                    width: `${minimapViewport.width}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          {navigation.previous ? (
            <NavArrow
              href={navigation.previous.href}
              direction="left"
              label={`Previous image: ${navigation.previous.title}`}
              title={navigation.previous.title}
            />
          ) : null}

          {navigation.next ? (
            <NavArrow
              href={navigation.next.href}
              direction="right"
              label={`Next image: ${navigation.next.title}`}
              title={navigation.next.title}
              shiftForInspector={inspectorOpen}
            />
          ) : null}

          <div
            className={cn(
              "absolute right-4 z-20 rounded-full border border-white/14 bg-black/65 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75 backdrop-blur-lg transition-all duration-300 md:right-6",
              filmstripOpen ? "bottom-24 md:bottom-28" : "bottom-4 md:bottom-6",
            )}
          >
            <span>{navigation.positionLabel ?? "-- / --"}</span>
            <span className="mx-2 text-white/40">|</span>
            <span>{Math.round(view.zoom * 100)}%</span>
          </div>

          {hasFilmstrip ? (
            <button
              type="button"
              onClick={() => setFilmstripOpen((current) => !current)}
              className={cn(
                "absolute left-4 z-20 rounded-full border border-white/18 bg-black/65 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/78 backdrop-blur-lg transition-all duration-300 hover:border-white/45 hover:text-white md:left-6",
                filmstripOpen ? "bottom-24 md:bottom-28" : "bottom-4 md:bottom-6",
              )}
            >
              {filmstripOpen ? "Hide Strip" : "Show Strip"}
            </button>
          ) : null}

          {hasFilmstrip ? (
            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 z-20 border-t border-white/12 bg-[rgba(5,5,5,0.9)] backdrop-blur-xl transition-all duration-300",
                filmstripOpen
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-full opacity-0",
              )}
            >
              <div className="flex gap-2 overflow-x-auto px-4 py-3 md:px-6">
                {navigation.stripItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-label={`Open ${item.title}`}
                    className={cn(
                      "relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-md border transition",
                      item.active
                        ? "border-white shadow-[0_0_0_1px_rgba(255,255,255,0.45)]"
                        : "border-white/20 hover:border-white/55",
                    )}
                  >
                    <img
                      src={item.thumbUrl}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {toolMenu ? (
        <div
          className="fixed z-50 w-[17rem] rounded-2xl border border-white/10 bg-[rgba(12,12,12,0.97)] p-2 text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          style={{ left: toolMenu.x, top: toolMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ToolButton
            label={
              inspectorOpen && inspectorTab === "histogram"
                ? "Hide histogram"
                : "Show histogram"
            }
            hint="Open the histogram tab in the inspector"
            onClick={() => {
              if (inspectorOpen && inspectorTab === "histogram") {
                setInspectorOpen(false);
              } else {
                setInspectorOpen(true);
                setInspectorTab("histogram");
              }
              closeToolMenu();
            }}
          />
          <ToolButton
            label={
              inspectorOpen && inspectorTab === "metadata"
                ? "Hide metadata"
                : "Show metadata"
            }
            hint="Open the metadata tab in the inspector"
            onClick={() => {
              if (inspectorOpen && inspectorTab === "metadata") {
                setInspectorOpen(false);
              } else {
                setInspectorOpen(true);
                setInspectorTab("metadata");
              }
              closeToolMenu();
            }}
          />
          <ToolButton
            label="Download original"
            hint={
              asset.downloadUrl
                ? "Download the full original image file"
                : "Download is disabled for this photo"
            }
            onClick={handleDownloadOriginal}
            disabled={!asset.downloadUrl}
          />
          <ToolButton
            label={
              asset.people[0]
                ? asset.people.length === 1
                  ? `See more of ${asset.people[0].displayName}`
                  : "Open linked person pages"
                : "No linked people yet"
            }
            hint={
              asset.people[0]
                ? "Open the canonical people pages linked to this photo"
                : "Sync Lightroom and Immich people to enable person pages"
            }
            onClick={handlePersonSearch}
            disabled={!asset.people.length}
          />
          <ToolButton
            label="Reset to fit"
            hint="Return to fit-to-screen view"
            onClick={() => {
              resetView();
              closeToolMenu();
            }}
          />
        </div>
      ) : null}

      <aside
        className={cn(
          "fixed left-3 right-3 top-[4.5rem] z-40 max-h-[38svh] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[rgba(5,5,5,0.9)] px-3 py-3 text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] backdrop-blur-xl transition-transform duration-300 md:left-auto md:right-2 md:top-2 md:bottom-2 md:max-h-none md:w-[22rem] md:max-w-[calc(100vw-1rem)] md:px-5 md:py-4 md:shadow-[-30px_0_80px_rgba(0,0,0,0.55)]",
          inspectorOpen
            ? "translate-y-0 md:translate-x-0 md:translate-y-0"
            : "pointer-events-none -translate-y-[calc(100%+5rem)] md:translate-x-[calc(100%+1rem)] md:translate-y-0",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.38em] text-white/42">
              Inspector
            </p>
            <h2 className="display-font mt-1 text-xl leading-tight text-white md:mt-2 md:text-3xl md:leading-none">
              {asset.title}
            </h2>
          </div>

          <IconButton label="Close inspector" onClick={() => setInspectorOpen(false)}>
            Close
          </IconButton>
        </div>

        <div className="mt-3 flex rounded-full border border-white/10 bg-black/35 p-1 md:mt-4">
          <button
            type="button"
            onClick={() => setInspectorTab("metadata")}
            className={cn(
              "w-1/2 rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] transition md:text-xs md:tracking-[0.24em]",
              inspectorTab === "metadata"
                ? "bg-white text-black"
                : "text-white/65 hover:text-white",
            )}
          >
            Metadata
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab("histogram")}
            className={cn(
              "w-1/2 rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] transition md:text-xs md:tracking-[0.24em]",
              inspectorTab === "histogram"
                ? "bg-white text-black"
                : "text-white/65 hover:text-white",
            )}
          >
            Histogram
          </button>
        </div>

        <div className="mt-4 space-y-4 md:mt-5 md:space-y-6">
          {inspectorTab === "histogram" ? (
            <section className="space-y-3 md:space-y-4">
              <p className="text-[11px] uppercase tracking-[0.34em] text-white/45">
                Histogram tools
              </p>
              <div className="rounded-2xl border border-white/10 bg-black/60 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/42">
                  Pixel probe
                </p>
                {pixelProbe ? (
                  <>
                    <div className="mt-2 flex items-center gap-2.5 md:gap-3">
                      <span
                        className="h-8 w-8 rounded-md border border-white/15 md:h-9 md:w-9"
                        style={{ backgroundColor: pixelProbe.hex }}
                      />
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-white md:text-sm">
                          {pixelProbe.hex}
                        </p>
                        <p className="text-[11px] text-white/62 md:text-xs">
                          RGB {pixelProbe.rgb}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 space-y-1 text-[11px] text-white/72 md:mt-3 md:text-xs">
                      <p>Brightness: {pixelProbe.brightness.toFixed(1)}%</p>
                      <p className="text-red-200/90">
                        Red: {pixelProbe.redLevel.toFixed(1)}% level, {pixelProbe.redShare.toFixed(1)}% mix
                      </p>
                      <p className="text-emerald-200/90">
                        Green: {pixelProbe.greenLevel.toFixed(1)}% level, {pixelProbe.greenShare.toFixed(1)}% mix
                      </p>
                      <p className="text-sky-200/90">
                        Blue: {pixelProbe.blueLevel.toFixed(1)}% level, {pixelProbe.blueShare.toFixed(1)}% mix
                      </p>
                      <p className="text-white/58">
                        Pixel: {pixelProbe.imageX}, {pixelProbe.imageY}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-white/62 md:text-sm">
                    Move the pointer over the image to sample color and brightness.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/60 px-3 py-3">
                {histogramPending ? (
                  <p className="text-xs text-white/62 md:text-sm">Calculating histogram...</p>
                ) : histogramError ? (
                  <div className="space-y-3">
                    <p className="text-xs text-amber-200/90 md:text-sm">{histogramError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setHistogram(null);
                        setHistogramError(null);
                      }}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/80 transition hover:border-white/45 hover:text-white"
                    >
                      Retry
                    </button>
                  </div>
                ) : histogram ? (
                  <div className="space-y-3">
                    <HistogramChart
                      bins={histogram.luma}
                      label="Luma"
                      barClassName="bg-white/80"
                    />
                    <HistogramChart
                      bins={histogram.red}
                      label="Red"
                      barClassName="bg-red-400/85"
                    />
                    <HistogramChart
                      bins={histogram.green}
                      label="Green"
                      barClassName="bg-emerald-400/85"
                    />
                    <HistogramChart
                      bins={histogram.blue}
                      label="Blue"
                      barClassName="bg-sky-400/85"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-white/62 md:text-sm">Histogram is not ready yet.</p>
                )}
              </div>
            </section>
          ) : (
            <>
              {asset.description ? (
                <p className="text-xs leading-6 text-white/72 md:text-sm md:leading-7">
                  {asset.description}
                </p>
              ) : null}

              <PhotoMetadata asset={asset} variant="stacked" />
            </>
          )}
        </div>
      </aside>
    </>
  );
}

interface HistogramChartProps {
  barClassName: string;
  bins: number[];
  label: string;
}

function HistogramChart({ barClassName, bins, label }: HistogramChartProps) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-[0.26em] text-white/45">
        {label}
      </p>
      <div className="flex h-14 items-end gap-[2px] md:h-20">
        {bins.map((value, index) => (
          <span
            key={`${label}-hist-${index}`}
            className={cn("w-full rounded-sm", barClassName)}
            style={{ height: `${Math.max(3, value * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

interface IconButtonProps {
  active?: boolean;
  children: string;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}

function IconButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-4 text-[11px] font-semibold uppercase tracking-[0.28em] transition",
        active
          ? "border-white bg-white text-black"
          : "border-white/18 bg-black/40 text-white/78 hover:border-white/45 hover:text-white",
        disabled && "cursor-not-allowed border-white/10 text-white/26 hover:border-white/10 hover:text-white/26",
      )}
    >
      {children}
    </button>
  );
}

interface IconLinkProps {
  children: string;
  external?: boolean;
  href: string;
  label: string;
}

function IconLink({
  children,
  external = false,
  href,
  label,
}: IconLinkProps) {
  if (external) {
    return (
      <a
        href={href}
        aria-label={label}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/18 bg-black/40 px-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/78 transition hover:border-white/45 hover:text-white"
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/18 bg-black/40 px-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/78 transition hover:border-white/45 hover:text-white"
    >
      {children}
    </Link>
  );
}

interface NavArrowProps {
  direction: "left" | "right";
  href: string;
  label: string;
  shiftForInspector?: boolean;
  title: string;
}

function NavArrow({
  direction,
  href,
  label,
  shiftForInspector = false,
  title,
}: NavArrowProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group absolute top-1/2 z-20 flex h-24 w-16 -translate-y-1/2 items-center justify-center text-white/72 transition hover:text-white md:h-32 md:w-24",
        direction === "left"
          ? "left-0"
          : shiftForInspector
            ? "right-0 md:right-[22.5rem]"
            : "right-0",
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition group-hover:opacity-100",
          direction === "left"
            ? "bg-gradient-to-r from-black/70 to-transparent"
            : "bg-gradient-to-l from-black/70 to-transparent",
        )}
      />
      <span className="relative text-4xl md:text-5xl">
        {direction === "left" ? "<" : ">"}
      </span>
      <span className="sr-only">{label}</span>
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 hidden max-w-[13rem] -translate-y-1/2 rounded-full border border-white/14 bg-black/75 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/76 md:block",
          direction === "left"
            ? "left-16"
            : shiftForInspector
              ? "right-16 md:right-[24rem]"
              : "right-16",
        )}
      >
        {title}
      </span>
    </Link>
  );
}

interface ToolButtonProps {
  disabled?: boolean;
  hint: string;
  label: string;
  onClick: () => void;
}

function ToolButton({
  disabled = false,
  hint,
  label,
  onClick,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border border-transparent px-3 py-2.5 text-left transition",
        disabled
          ? "cursor-not-allowed text-white/30"
          : "text-white/82 hover:border-white/10 hover:bg-white/5",
      )}
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs text-white/45">{hint}</p>
    </button>
  );
}
