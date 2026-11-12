package main

import (
	"context"
	"log"

	c "github.com/elvuel/mkp-kit/go/examples/commonpkg"
	"github.com/elvuel/mkp-kit/go/helper"
)

func main() {
	c.InitSFport()

	output, err := helper.ListDirContext(context.Background(), c.SFPort, "/eMMC")

	if err != nil {
		log.Fatalln(err)
	}

	c.Log(output)
}

