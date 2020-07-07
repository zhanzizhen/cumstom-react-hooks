import { useState, useCallback } from "react";
import { EditorState } from "react-draft-wysiwyg";
import Draft from "draft-js";
import htmlToDraft from "html-to-draftjs";
import draftToHtml from "draftjs-to-html";

const convertStrToState = (content: string) => {
  const blocksFromHTML = htmlToDraft(content);
  const contentState = Draft.ContentState.createFromBlockArray(
    blocksFromHTML.contentBlocks,
    blocksFromHTML.entityMap
  );
  return Draft.EditorState.createWithContent(contentState);
};

/**目的：简化react-draft-wysiwyg的使用 */
export default function useEditor({
  initialHtml = "",
}: {
  initialHtml: string;
}) {
  const [editorState, setEditorState] = useState<EditorState>(
    initialHtml
      ? convertStrToState(initialHtml)
      : Draft.EditorState.createEmpty()
  );

  /**获取编辑器的html内容 */
  const getHtml: () => string = useCallback(() => {
    return draftToHtml(
      Draft.convertToRaw(editorState.getCurrentContent())
    ).trim();
  }, [editorState]);

  /**获取编辑器的text内容 */
  const getPlainText: () => string = useCallback(() => {
    let abstract = editorState.getCurrentContent().getPlainText();
    return abstract.replace(/\n/g, "").trim();
  }, [editorState]);

  return {
    editorProps: {
      onEditorStateChange: setEditorState,
      editorState,
      localization: {
        locale: "zh",
      },
    },
    getHtml,
    getPlainText,
  };
}
