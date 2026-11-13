package io.github.elvuel.mkpkit.java;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class KpadOption {
    private final List<String> modKeys = new ArrayList<>();
    private final String[] keys = new String[] {"", "", "", "", "", ""};
    private int release;
    private int delay;
    private boolean verbose;
    private boolean asyncMode = true;
    private boolean syncIgnoreOutput;
    private CommitKeys commitKeys;

    public List<String> modKeys() { return List.copyOf(modKeys); }
    public List<String> keys() { return List.of(keys); }
    public int release() { return release; }
    public int delay() { return delay; }
    public boolean verbose() { return verbose; }
    public boolean asyncMode() { return asyncMode; }
    public boolean syncIgnoreOutput() { return syncIgnoreOutput; }

    public KpadOption withKeys(List<String> values) {
        List<String> normalized = values.stream().map(Keycodes::normalizeKpadKey).filter(value -> !value.isEmpty()).toList();
        Keycodes.SplitKeys split = Keycodes.splitKeys(normalized);
        modKeys.clear();
        modKeys.addAll(split.modKeys());
        Arrays.fill(keys, "");
        List<String> normal = split.normalKeys();
        for (int index = 0; index < Math.min(6, normal.size()); index++) {
            keys[index] = normal.get(index);
        }
        return this;
    }

    public KpadOption withKey(String key) {
        Arrays.fill(keys, "");
        keys[0] = Keycodes.normalizeKpadKey(key);
        return this;
    }

    public KpadOption withModKeys(List<String> values) {
        modKeys.clear();
        modKeys.addAll(values);
        return this;
    }

    public KpadOption withDelay(int value) { this.delay = value; return this; }
    public KpadOption withRelease(int value) { this.release = value; return this; }
    public KpadOption withHold() { this.release = 0; return this; }
    public KpadOption withAutoRelease() { this.release = 1; return this; }
    public KpadOption withDuration(int duration) { if (duration > 1) { this.release = duration; } return this; }
    public KpadOption withVerbose(boolean value) { this.verbose = value; return this; }

    public KpadOption withAsync(boolean value) {
        this.asyncMode = value;
        this.syncIgnoreOutput = !value;
        return this;
    }

    public KpadOption withSyncIgnoreOutput(boolean value) {
        this.syncIgnoreOutput = value;
        this.asyncMode = !value;
        return this;
    }

    public boolean isAsync() {
        return asyncMode && !syncIgnoreOutput;
    }

    public String toCliFragment() {
        List<String> args = new ArrayList<>();
        String status = Keycodes.modStatus(modKeys);
        if (!status.isEmpty()) {
            args.add("--s");
            args.add(status);
        }
        for (int index = 0; index < keys.length; index++) {
            String key = keys[index];
            if (key == null || key.isEmpty()) {
                continue;
            }
            String code = Keycodes.keyNameToHexcode(key);
            if (code == null) {
                throw new IllegalArgumentException("unknown key name: " + key);
            }
            args.add("--x" + (index + 1));
            args.add(code);
        }
        args.add("--rel");
        args.add(String.valueOf(release));
        args.add("--d");
        args.add(String.valueOf(delay));
        if (verbose) {
            args.add("--v");
            args.add("1");
        }
        return String.join(" ", args);
    }

    public KpadOption keyDown(String key) {
        List<String> downKeys = Keycodes.expandKpadInputKey(key);
        if (downKeys.isEmpty()) {
            return this;
        }
        KpadPressedState.Snapshot snapshot = KpadPressedState.snapshot();
        List<String> nextMod = new ArrayList<>(snapshot.modKeys());
        List<String> nextKeys = new ArrayList<>(snapshot.keys());
        for (String item : downKeys) {
            if (Keycodes.isModKey(item)) {
                KpadPressedState.appendOnce(nextMod, item);
            } else {
                KpadPressedState.appendOnce(nextKeys, item);
            }
        }
        List<String> merged = new ArrayList<>(nextMod);
        merged.addAll(nextKeys);
        withKeys(merged).withModKeys(nextMod).withHold();
        this.commitKeys = new CommitKeys(downKeys, true);
        return this;
    }

    public KeyUpPlan keyUp(String key) {
        List<String> releaseKeys = Keycodes.expandKpadInputKey(key);
        if (releaseKeys.isEmpty()) {
            return new KeyUpPlan(null, null);
        }
        KpadPressedState.Snapshot snapshot = KpadPressedState.snapshot();
        List<String> releaseMod = new ArrayList<>(snapshot.modKeys());
        List<String> nextMod = new ArrayList<>(snapshot.modKeys());
        List<String> nextKeys = new ArrayList<>(snapshot.keys());
        for (String item : releaseKeys) {
            if (Keycodes.isModKey(item)) {
                nextMod.remove(item);
            } else {
                nextKeys.remove(item);
            }
        }

        KpadOption releaseOption = new KpadOption()
            .withDelay(delay)
            .withVerbose(verbose)
            .withAsync(asyncMode)
            .withKeys(releaseKeys)
            .withAutoRelease();
        releaseOption.syncIgnoreOutput = syncIgnoreOutput;
        if (releaseKeys.stream().anyMatch(Keycodes::isModKey)) {
            releaseOption.withModKeys(releaseMod);
        }

        KpadOption remainOption = new KpadOption()
            .withDelay(delay)
            .withVerbose(verbose)
            .withAsync(asyncMode);
        remainOption.syncIgnoreOutput = syncIgnoreOutput;
        List<String> remain = new ArrayList<>(nextMod);
        remain.addAll(nextKeys);
        if (remain.isEmpty()) {
            remainOption.withKey("NONE").withHold();
        } else {
            remainOption.withKeys(remain);
            if (releaseKeys.stream().anyMatch(Keycodes::isModKey)) {
                remainOption.withModKeys(nextMod);
            }
        }
        remainOption.commitKeys = new CommitKeys(releaseKeys, false);
        return new KeyUpPlan(releaseOption, remainOption);
    }

    public void commitState() {
        if (commitKeys == null) {
            return;
        }
        if (commitKeys.isDown()) {
            KpadPressedState.appendDown(commitKeys.keys());
        } else {
            KpadPressedState.applyUp(commitKeys.keys());
        }
        commitKeys = null;
    }

    public KpadOption copy() {
        return new KpadOption()
            .withModKeys(modKeys)
            .withKeys(Arrays.asList(keys))
            .withRelease(release)
            .withDelay(delay)
            .withVerbose(verbose)
            .withAsync(asyncMode)
            .withSyncIgnoreOutput(syncIgnoreOutput);
    }

    public record KeyUpPlan(KpadOption release, KpadOption remain) {
    }

    private record CommitKeys(List<String> keys, boolean isDown) {
    }
}
