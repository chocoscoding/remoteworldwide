export function closeUploadWidget(widget: { close: () => void }): void {
  widget.close();
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }
}
