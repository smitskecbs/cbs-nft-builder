export type CollectionStudioPane = 'gallery' | 'item-editor';

export type HiddenFlag = {
  hidden: boolean;
};

export function collectionItemEditorHeading(itemName: string): string {
  return `Create ${itemName.trim() || 'next NFT'}`;
}

export function applyCollectionStudioPane(params: {
  pane: CollectionStudioPane;
  gallery: HiddenFlag;
  editor: HiddenFlag;
  extras?: HiddenFlag | null;
}): void {
  const editing = params.pane === 'item-editor';
  params.gallery.hidden = editing;
  params.editor.hidden = !editing;
  if (params.extras) {
    params.extras.hidden = editing;
  }
}

export function leavingCollectionItemEditorDeletesDraft(): false {
  return false;
}

export function collectionItemEditorAutoUploadsOrMints(): false {
  return false;
}
