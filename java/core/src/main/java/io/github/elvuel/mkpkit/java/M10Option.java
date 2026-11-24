package io.github.elvuel.mkpkit.java;

import java.util.ArrayList;
import java.util.List;

public final class M10Option {
    private Integer button;
    private Integer x;
    private Integer y;
    private Integer wheel;
    private boolean asyncMode = true;
    private boolean syncIgnoreOutput;
    private Integer syncOutputTimeoutMs;

    public Integer button() { return button; }
    public Integer x() { return x; }
    public Integer y() { return y; }
    public Integer wheel() { return wheel; }
    public boolean asyncMode() { return asyncMode; }
    public boolean syncIgnoreOutput() { return syncIgnoreOutput; }
    public Integer syncOutputTimeoutMs() { return syncOutputTimeoutMs; }

    public M10Option setButton(Integer value) { this.button = value; return this; }
    public M10Option withButton(Integer value) { return setButton(value); }
    public M10Option withoutButton() { this.button = null; return this; }
    public M10Option setX(Integer value) { this.x = value; return this; }
    public M10Option setY(Integer value) { this.y = value; return this; }
    public M10Option setWheel(Integer value) { this.wheel = value; return this; }

    public M10Option withAsync(boolean value) {
        this.asyncMode = value;
        this.syncIgnoreOutput = !value;
        return this;
    }

    public M10Option withSyncIgnoreOutput(boolean value) {
        this.syncIgnoreOutput = value;
        this.asyncMode = !value;
        return this;
    }

    public M10Option withSyncOutputTimeout(Integer value) {
        this.syncOutputTimeoutMs = value;
        return this;
    }

    public boolean isAsync() {
        return asyncMode && !syncIgnoreOutput;
    }

    public String toCliFragment() {
        List<String> args = new ArrayList<>();
        if (button != null) {
            args.add("--b");
            args.add(String.valueOf(button));
        }
        if (x != null) {
            args.add("--x");
            args.add(String.valueOf(x));
        }
        if (y != null) {
            args.add("--y");
            args.add(String.valueOf(y));
        }
        if (wheel != null) {
            args.add("--w");
            args.add(String.valueOf(wheel));
        }
        return String.join(" ", args);
    }

    public M10Option copy() {
        return new M10Option()
            .setButton(button)
            .setX(x)
            .setY(y)
            .setWheel(wheel)
            .withAsync(asyncMode)
            .withSyncIgnoreOutput(syncIgnoreOutput)
            .withSyncOutputTimeout(syncOutputTimeoutMs);
    }
}
