plugins {
    application
}

base {
    archivesName.set("mkpkit-java-examples")
}

dependencies {
    implementation(project(":core"))
}

application {
    mainClass = "io.github.elvuel.mkpkit.java.examples.M10Example"
    applicationName = "mkpkit-java-examples"
}

fun registerExampleTask(taskName: String, mainClassName: String) {
    tasks.register<JavaExec>(taskName) {
        group = "application"
        description = "Run $mainClassName"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set(mainClassName)
    }
}

registerExampleTask("runM10", "io.github.elvuel.mkpkit.java.examples.M10Example")
registerExampleTask("runKpad", "io.github.elvuel.mkpkit.java.examples.KpadExample")
registerExampleTask("runM10Device", "io.github.elvuel.mkpkit.java.examples.M10DeviceExample")
registerExampleTask("runKpadDevice", "io.github.elvuel.mkpkit.java.examples.KpadDeviceExample")
registerExampleTask("runSn", "io.github.elvuel.mkpkit.java.examples.directives.SnExample")
registerExampleTask("runAlive", "io.github.elvuel.mkpkit.java.examples.directives.AliveExample")
registerExampleTask("runAversion", "io.github.elvuel.mkpkit.java.examples.directives.AVersionExample")
registerExampleTask("runAtime", "io.github.elvuel.mkpkit.java.examples.directives.ATimeExample")
registerExampleTask("runAinsp", "io.github.elvuel.mkpkit.java.examples.directives.AInspExample")
registerExampleTask("runListDir", "io.github.elvuel.mkpkit.java.examples.directives.ListDirExample")
registerExampleTask("runCleanDir", "io.github.elvuel.mkpkit.java.examples.directives.CleanDirExample")
registerExampleTask("runDeleteFile", "io.github.elvuel.mkpkit.java.examples.directives.DeleteFileExample")
registerExampleTask("runJoin", "io.github.elvuel.mkpkit.java.examples.directives.JoinExample")
registerExampleTask("runWifiAuto", "io.github.elvuel.mkpkit.java.examples.directives.WifiAutoExample")
registerExampleTask("runAhttpbase", "io.github.elvuel.mkpkit.java.examples.directives.AHttpBaseExample")
registerExampleTask("runAdumj", "io.github.elvuel.mkpkit.java.examples.directives.ADumjExample")
registerExampleTask("runAget", "io.github.elvuel.mkpkit.java.examples.directives.AGetExample")
registerExampleTask("runAput", "io.github.elvuel.mkpkit.java.examples.directives.APutExample")
registerExampleTask("runAjson2log", "io.github.elvuel.mkpkit.java.examples.directives.AJson2LogExample")
registerExampleTask("runAlog", "io.github.elvuel.mkpkit.java.examples.directives.ALogExample")
registerExampleTask("runAstop", "io.github.elvuel.mkpkit.java.examples.directives.AStopExample")
registerExampleTask("runAcancel", "io.github.elvuel.mkpkit.java.examples.directives.ACancelExample")
registerExampleTask("runAplay", "io.github.elvuel.mkpkit.java.examples.directives.APlayExample")
