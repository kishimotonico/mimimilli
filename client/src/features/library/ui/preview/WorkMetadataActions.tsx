import { Menu } from "@ark-ui/react/menu";
import { MenuLayerItem } from "../../../../shared/ui/menu/MenuLayerItem";
import type { Work } from "@mimimilli/shared";
import { toSafeExternalUrlHref } from "@mimimilli/shared";
import { I } from "../../../../shared/ui/Icon";
import IconButton from "../../../../shared/ui/IconButton";
import { apiErrorMessage } from "../../../../shared/lib/apiError";
import type { BookmarkWorkMutation } from "../../../../entities/work/model/workMutations";
import { MenuPopup, MotionMenuRoot, useMotionMenu } from "../../../../shared/ui/menu/MotionMenu";
import {
  MENU_GUTTER,
  MENU_LABEL_CLASS,
  MENU_SEPARATOR_CLASS,
  menuItemClass,
} from "../../../../shared/ui/menu/menuStyles";

interface WorkMetadataActionsProps {
  work: Work;
  bookmarkMutation: BookmarkWorkMutation;
  onEdit: () => void;
  onShowInfo: () => void;
  onDelete: () => void;
}

export function WorkMetadataActions({
  work,
  bookmarkMutation,
  onEdit,
  onShowInfo,
  onDelete,
}: WorkMetadataActionsProps) {
  const menu = useMotionMenu({
    positioning: { placement: "bottom-end", gutter: MENU_GUTTER },
    onEscapeKeyDown: () => bookmarkMutation.reset(),
  });
  const open = menu.menu.api.open;

  const toggleBookmark = () => {
    if (bookmarkMutation.isPending) return;
    bookmarkMutation.reset();
    bookmarkMutation.mutate({
      workId: work.id,
      bookmarked: !work.bookmarked,
    });
  };

  const bookmarkError = bookmarkMutation.error
    ? apiErrorMessage(bookmarkMutation.error, "ブックマークを更新できませんでした。")
    : null;

  return (
    <div className="mle-prv__actions">
      <IconButton
        icon={I.heart}
        label={work.bookmarked ? "ブックマークを解除" : "ブックマークに追加"}
        size="sm"
        active={work.bookmarked}
        disabled={bookmarkMutation.isPending}
        className={work.bookmarked ? "[&_svg]:fill-current" : undefined}
        onClick={toggleBookmark}
      />
      <IconButton icon={I.edit} label="作品を編集" size="sm" onClick={onEdit} />
      <MotionMenuRoot handle={menu}>
        <Menu.Trigger asChild>
          <IconButton
            icon={I.more}
            label="その他"
            size="sm"
            active={open}
            onClick={() => bookmarkMutation.reset()}
          />
        </Menu.Trigger>
        <MenuPopup origin="top right">
          <MenuLayerItem
            value="info"
            valueText="作品の情報"
            onSelect={onShowInfo}
            className={menuItemClass()}
          >
            <span className={MENU_LABEL_CLASS}>作品の情報</span>
          </MenuLayerItem>
          {work.urls.length > 0 && (
            <>
              <Menu.Separator className={MENU_SEPARATOR_CLASS} />
              {work.urls.map((u) => {
                const href = toSafeExternalUrlHref(u.url);
                const label = u.label === "DLsite" ? "DLsiteを開く" : `${u.label}を開く`;
                return href ? (
                  <Menu.Item
                    key={u.url}
                    value={u.url}
                    valueText={label}
                    asChild
                    className={menuItemClass()}
                  >
                    <a href={href} target="_blank" rel="noreferrer">
                      <span className={MENU_LABEL_CLASS}>{label}</span>
                    </a>
                  </Menu.Item>
                ) : (
                  <Menu.Item
                    key={u.url}
                    value={u.url}
                    valueText={label}
                    disabled
                    className={menuItemClass()}
                  >
                    <span className={MENU_LABEL_CLASS}>{label}</span>
                  </Menu.Item>
                );
              })}
            </>
          )}
          <Menu.Separator className={MENU_SEPARATOR_CLASS} />
          <MenuLayerItem
            value="delete"
            valueText="登録解除"
            onSelect={onDelete}
            className={menuItemClass({ danger: true })}
          >
            <span className={MENU_LABEL_CLASS}>登録解除</span>
          </MenuLayerItem>
        </MenuPopup>
      </MotionMenuRoot>
      {bookmarkError && (
        <p className="mle-prv__edit-error" role="alert">
          {bookmarkError}
        </p>
      )}
    </div>
  );
}
