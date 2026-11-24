import hashlib
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import warnings
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import public_checkout_cp058 as c

SHA = "0123456789abcdef" * 2 + "01234567"
TREE = "badc0ffe" * 5


def fake_archive(files, prefix=None, *, attrs=None):
    prefix = prefix or f"{c.REPO}-{SHA}"
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as zipped:
        zipped.writestr(prefix + "/", b"")
        for path, data in files.items():
            zi = zipfile.ZipInfo(prefix + "/" + path)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = ((attrs or {}).get(path, stat.S_IFREG | 0o644) << 16)
            zipped.writestr(zi, data)
    return stream.getvalue()


def fake_tree(files):
    return {k: {"sha": c.git_blob_sha(v), "mode": "100644", "size": len(v)} for k, v in files.items()}


class SourceIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.files = {"README.md": b"Crownicles\n", "sub/script.mjs": b"export const x=1;\n", "img/icon.webp": b"\0\xff\x80"}
        self.tree = fake_tree(self.files)
        self.zip = fake_archive(self.files)

    def test_valid_public_archive_blob_sha_binaries_and_nested(self):
        self.assertEqual(c.verify_archive(self.zip, self.tree), self.files)
        self.assertEqual(c.git_blob_sha(b"hello"), hashlib.sha1(b"blob 5\0hello").hexdigest())

    def test_tampering_rejected_before_materialization(self):
        bad = dict(self.files); bad["sub/script.mjs"] = b"modified"
        with self.assertRaisesRegex(c.CheckoutError, "BLOB_SHA_MISMATCH"):
            c.verify_archive(fake_archive(bad), self.tree)

    def test_missing_and_extra_file_rejected(self):
        with self.assertRaisesRegex(c.CheckoutError, "MISSING_BLOBS"):
            c.verify_archive(fake_archive({"README.md": b"Crownicles\n"}), self.tree)
        bad = dict(self.files);bad["extra.js"] = b"alert(1)"
        with self.assertRaisesRegex(c.CheckoutError, "EXTRA_FILE"):
            c.verify_archive(fake_archive(bad), self.tree)

    def test_zip_traversal_absolute_and_other_root_rejected(self):
        for bad_name in ["../evil", "a/../evil", "/evil", "a\\evil", "./evil"]:
            with self.subTest(bad_name=bad_name):
                bad = dict(self.files); bad[bad_name] = b"x"
                with self.assertRaises(c.CheckoutError):
                    c.verify_archive(fake_archive(bad), self.tree)
        with self.assertRaisesRegex(c.CheckoutError, "ROOT_UNEXPECTED"):
            c.verify_archive(fake_archive(self.files, prefix="other-repo-"+SHA), self.tree)

    def test_duplicate_zip_file_names_and_symlink_rejected(self):
        prefix = f"{c.REPO}-{SHA}/"
        with io.BytesIO() as stream:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                with zipfile.ZipFile(stream,"w") as zipped:
                    zipped.writestr(prefix + "README.md", self.files["README.md"])
                    zipped.writestr(prefix + "README.md", self.files["README.md"])
            with self.assertRaisesRegex(c.CheckoutError,"DUPLICATE_FILE"):
                c.verify_archive(stream.getvalue(), self.tree)
        with self.assertRaisesRegex(c.CheckoutError, "SYMLINK"):
            c.verify_archive(fake_archive(self.files, attrs={"README.md": stat.S_IFLNK | 0o777}), self.tree)

    def test_corrupt_archive_or_truncated_tree_rejected(self):
        with self.assertRaisesRegex(c.CheckoutError,"ARCHIVE_INVALID"):
            c.verify_archive(b"not a zip",self.tree)
        with patch.object(c, "load_json", side_effect=[
            {"sha":SHA,"tree":{"sha":TREE}}, {"sha":TREE,"truncated":True,"tree":[]}
        ]):
            with self.assertRaisesRegex(c.CheckoutError,"TRUNCATED"):
                c.source_tree(SHA)

    def test_git_symlink_and_submodule_rejected(self):
        for typ, mode in [("blob", "120000"), ("commit", "160000")]:
            with patch.object(c, "load_json", side_effect=[
                {"sha":SHA,"tree":{"sha":TREE}},
                {"sha":TREE,"truncated":False,"tree":[{"type":typ,"mode":mode,"sha":SHA,"path":"link","size":1}]}
            ]):
                with self.assertRaisesRegex(c.CheckoutError,"NON_REGULAR_GIT_ENTRY"):
                    c.source_tree(SHA)

    def test_public_pr_resolves_only_repo_owned_head(self):
        with patch.object(c, "load_json", return_value={"head":{"sha":SHA,"repo":{"full_name":f"{c.OWNER}/{c.REPO}"}}}):
            self.assertEqual(c.resolve_commit(30,None),SHA)
        with patch.object(c, "load_json", return_value={"head":{"sha":SHA,"repo":{"full_name":"other/evil"}}}):
            with self.assertRaisesRegex(c.CheckoutError,"EXPECTED_REPOSITORY"):
                c.resolve_commit(30,None)
        with self.assertRaisesRegex(c.CheckoutError,"INVALID_40_HEX"):
            c.resolve_commit(None,"HEAD")

    def test_materialization_atomic_no_overwrite_and_no_symlink_parent(self):
        with tempfile.TemporaryDirectory() as root:
            dst = Path(root)/"verified"
            c.materialize(self.files, dst)
            for path, raw in self.files.items():
                self.assertEqual((dst/path).read_bytes(),raw)
            with self.assertRaisesRegex(c.CheckoutError,"DESTINATION_EXISTS"):
                c.materialize(self.files,dst)
            link = Path(root)/"sym"
            try:
                link.symlink_to(dst)
            except OSError:
                pass
            else:
                with self.assertRaisesRegex(c.CheckoutError,"DESTINATION_EXISTS"):
                    c.materialize(self.files,link)

    def test_verify_only_no_commands_default_and_evidence_status(self):
        with tempfile.TemporaryDirectory() as root:
            dst=Path(root)/"commit"
            with patch.object(c,"source_tree",return_value=self.tree),patch.object(c,"fetch",return_value=self.zip),patch.object(c,"run_checked") as runner:
                self.assertEqual(c.execute(["--sha",SHA,"--output",str(dst)]),0)
                runner.assert_not_called()
            state=json.loads((dst/"CP058-LOCAL-EVIDENCE.json").read_text())
            self.assertEqual(state["state"],"SOURCE_VERIFIED_ONLY")
            self.assertEqual(state["git_files"],3)
            self.assertFalse(state["source_execution_opt_in"])
            self.assertEqual(state["CI"],"NOT_USED")

    def test_opt_in_check_gate_records_exit_and_fails_closed(self):
        with tempfile.TemporaryDirectory() as root:
            dst=Path(root)/"runcase"
            with patch.object(c,"resolve_commit",return_value=SHA),patch.object(c,"source_tree",return_value=self.tree),patch.object(c,"fetch",return_value=self.zip),patch.object(c,"run_checked") as runner:
                runner.side_effect=[{"command":"npm run check","exit":0}, {"command":"npm run gate:p0:lab","exit":7}]
                with self.assertRaisesRegex(c.CheckoutError,"TEST_PROCESS_FAILED:gate:p0:lab"):
                    c.execute(["--pr","30","--output",str(dst),"--run-check","--run-gate"])
            # --pr resolution needs mock; handled below

    def test_runner_process_local_command_success_and_error(self):
        with tempfile.TemporaryDirectory() as root:
            ok=c.run_checked(["python3","-c","print('ok')"],Path(root),10,Path(root)/"pass.log")
            self.assertEqual(ok["exit"],0)
            fail=c.run_checked(["python3","-c","raise SystemExit(12)"],Path(root),10,Path(root)/"fail.log")
            self.assertEqual(fail["exit"],12)


if __name__=="__main__":
    unittest.main(verbosity=2)
