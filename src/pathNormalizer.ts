import * as path from "path";
import { Uri } from "vscode";
import { ISvnInfo } from "./common/types";
import { memoize } from "./decorators";
import { SvnRI } from "./svnRI";

enum ResourceKind {
  LocalRelative,
  LocalFull,
  RemoteFull
}

/**
 * create from Repository class
 */
export class PathNormalizer {
  public readonly repoRoot: Uri;
  public readonly branchRoot: Uri;
  public readonly checkoutRoot?: Uri;

  constructor(public readonly repoInfo: ISvnInfo) {
    this.repoRoot = Uri.parse(repoInfo.repository.root);
    this.branchRoot = Uri.parse(repoInfo.url);
    if (repoInfo.wcInfo) {
      this.checkoutRoot = Uri.file(repoInfo.wcInfo.wcrootAbspath);
    }
  }

  /** svn://foo.org/domain/trunk/x -> trunk/x */
  private getFullRepoPathFromUrl(fpath: string): string {
    if (fpath.startsWith("/")) {
      return fpath.substr(1);
    } else if (fpath.startsWith("svn://") || fpath.startsWith("file://")) {
      const target = Uri.parse(fpath).path;
      return path.relative(this.repoRoot.path, target);
    } else {
      throw new Error("unknown path");
    }
  }

  public parse(
    fpath: string,
    kind = ResourceKind.RemoteFull,
    rev?: string
  ): SvnRI {
    let target: string;
    if (kind === ResourceKind.RemoteFull) {
      target = this.getFullRepoPathFromUrl(fpath);
    } else if (kind === ResourceKind.LocalFull) {
      if (!path.isAbsolute(fpath)) {
        throw new Error("Path isn't absolute");
      }
      if (this.checkoutRoot === undefined) {
        throw new Error("Local paths are not");
      }
      target = path.join(
        this.fromRootToBranch(),
        path.relative(this.checkoutRoot.path, fpath)
      );
    } else if (kind === ResourceKind.LocalRelative) {
      if (path.isAbsolute(fpath)) {
        throw new Error("Path is absolute");
      }
      if (this.checkoutRoot === undefined) {
        throw new Error("Local paths are not");
      }
      target = path.join(this.fromRootToBranch(), fpath);
    } else {
      throw new Error("unsupported kind");
    }

    return new SvnRI(
      this.repoRoot,
      this.branchRoot,
      this.checkoutRoot,
      target,
      rev
    );
  }

  @memoize
  public fromRootToBranch(): string {
    return path.relative(this.repoRoot.path, this.branchRoot.path);
  }

  @memoize
  public fromBranchToRoot(): string {
    return path.relative(this.branchRoot.path, this.repoRoot.path);
  }
}
