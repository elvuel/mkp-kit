package main

import (
	"context"
	"log"

	c "github.com/elvuel/mkp-kit/go/examples/commonpkg"
	"github.com/elvuel/mkp-kit/go/helper"
)

func main() {
	c.InitSFport()

	err := helper.DeleteFileContext(context.Background(), c.SFPort, "/eMMC/applog/uuu3.log")

	if err != nil {
		log.Fatalln(err)
	}

	c.Log("succeed")
}

